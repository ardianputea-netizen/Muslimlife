package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"muslimlife/backend/internal/config"
	"muslimlife/backend/internal/middleware"
	"muslimlife/backend/internal/models"
)

type HadithHandler struct {
	db         *gorm.DB
	cfg        config.Config
	httpClient *http.Client
}

func NewHadithHandler(db *gorm.DB, cfg config.Config) *HadithHandler {
	return &HadithHandler{
		db:  db,
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type hadithListResponse struct {
	Data []hadithDTO `json:"data"`
	Meta gin.H       `json:"meta"`
}

type hadithDTO struct {
	ID           string `json:"id"`
	Collection   string `json:"collection"`
	BookNumber   string `json:"book_number"`
	HadithNumber string `json:"hadith_number"`
	Arab         string `json:"arab"`
	Translation  string `json:"translation"`
	Grade        string `json:"grade"`
	Reference    string `json:"reference"`
	SourceURL    string `json:"source_url"`
	IsBookmarked bool   `json:"is_bookmarked"`
}

type sunnahHadithListPayload struct {
	Data []sunnahHadith `json:"data"`
}

type sunnahHadithDetailPayload struct {
	Data sunnahHadith `json:"data"`
}

type sunnahHadith struct {
	Collection   string `json:"collection"`
	BookNumber   string `json:"bookNumber"`
	HadithNumber string `json:"hadithNumber"`
	Hadith       []struct {
		Lang   string `json:"lang"`
		Body   string `json:"body"`
		Grades []struct {
			Grade string `json:"grade"`
		} `json:"grades"`
	} `json:"hadith"`
}

type hadithBookmarkRequest struct {
	HadithID string `json:"hadith_id" binding:"required"`
	Bookmark *bool  `json:"bookmark"`
}

func (h *HadithHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	page := maxInt(parsePositiveInt(c.Query("page"), 1), 1)
	limit := clampInt(h.cfg.HadithPageLimit, 5, 50)
	offset := (page - 1) * limit

	collection := strings.ToLower(strings.TrimSpace(c.Query("collection")))
	queryText := strings.TrimSpace(c.Query("q"))

	records, total, err := h.queryLocalHadith(userID, collection, queryText, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query hadith"})
		return
	}

	syncCollection := collection
	if syncCollection == "" {
		syncCollection = "bukhari"
	}

	if len(records) == 0 && queryText == "" && h.canSyncSource() {
		if syncErr := h.syncSunnahPage(c.Request.Context(), syncCollection, page, limit); syncErr == nil {
			records, total, err = h.queryLocalHadith(userID, collection, queryText, limit, offset)
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query hadith"})
		return
	}

	collectionMeta := collection
	if collectionMeta == "" {
		collectionMeta = "all"
	}

	c.JSON(http.StatusOK, hadithListResponse{
		Data: toHadithDTO(records),
		Meta: gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"has_next":   int64(offset+len(records)) < total,
			"collection": collectionMeta,
			"source":     h.cfg.HadithSourceName,
		},
	})
}

func (h *HadithHandler) Detail(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hadith id"})
		return
	}

	var record models.Hadith
	err := h.db.Where("id = ?", id).First(&record).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query hadith"})
			return
		}

		if !h.canSyncSource() {
			c.JSON(http.StatusNotFound, gin.H{"error": "hadith not found"})
			return
		}

		fetched, fetchErr := h.syncSingleFromSource(c.Request.Context(), id)
		if fetchErr != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "hadith not found"})
			return
		}
		record = fetched
	}

	isBookmarked, bookmarkErr := h.isBookmarked(userID, record.ID)
	if bookmarkErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query bookmark"})
		return
	}

	dto := toHadithDTO([]hadithRecord{{Hadith: record, IsBookmarked: isBookmarked}})
	c.JSON(http.StatusOK, gin.H{
		"data": dto[0],
		"meta": gin.H{
			"source": h.cfg.HadithSourceName,
		},
	})
}

func (h *HadithHandler) Bookmark(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var request hadithBookmarkRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	hadithID := strings.TrimSpace(request.HadithID)
	if hadithID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hadith_id"})
		return
	}

	var record models.Hadith
	if err := h.db.Where("id = ?", hadithID).First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "hadith not found"})
		return
	}

	bookmarkValue := true
	if request.Bookmark != nil {
		bookmarkValue = *request.Bookmark
	}

	if bookmarkValue {
		bookmark := models.HadithBookmark{
			UserID:   userID,
			HadithID: hadithID,
		}

		if err := h.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "hadith_id"}},
			DoNothing: true,
		}).Create(&bookmark).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to bookmark hadith"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"hadith_id":      hadithID,
			"is_bookmarked":  true,
			"bookmark_state": "added",
		})
		return
	}

	if err := h.db.Where("user_id = ? AND hadith_id = ?", userID, hadithID).Delete(&models.HadithBookmark{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove bookmark"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hadith_id":      hadithID,
		"is_bookmarked":  false,
		"bookmark_state": "removed",
	})
}

func (h *HadithHandler) ListBookmarks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	records := make([]hadithRecord, 0)
	err := h.db.
		Table("hadith h").
		Select(`
			h.id, h.collection, h.book_number, h.hadith_number, h.arab, h.translation, h.grade, h.reference, h.source_url,
			true as is_bookmarked
		`).
		Joins("inner join hadith_bookmarks b on b.hadith_id = h.id").
		Where("b.user_id = ?", userID).
		Order("b.created_at desc").
		Scan(&records).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bookmarks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toHadithDTO(records),
		"meta": gin.H{
			"total":  len(records),
			"source": h.cfg.HadithSourceName,
		},
	})
}

type hadithRecord struct {
	models.Hadith
	IsBookmarked bool `json:"is_bookmarked"`
}

func (h *HadithHandler) queryLocalHadith(
	userID string,
	collection string,
	queryText string,
	limit int,
	offset int,
) ([]hadithRecord, int64, error) {
	base := h.db.Model(&models.Hadith{}).Where("collection = ?", collection)
	if strings.TrimSpace(collection) == "" {
		base = h.db.Model(&models.Hadith{})
	}
	if queryText != "" {
		search := "%" + queryText + "%"
		base = base.Where(
			"translation ILIKE ? OR arab ILIKE ? OR reference ILIKE ?",
			search, search, search,
		)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	items := make([]models.Hadith, 0)
	if err := base.
		Order("cast(nullif(regexp_replace(hadith_number, '[^0-9]', '', 'g'), '') as integer) asc nulls last, hadith_number asc").
		Limit(limit).
		Offset(offset).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}

	bookmarkedSet, err := h.loadBookmarkSet(userID, items)
	if err != nil {
		return nil, 0, err
	}

	result := make([]hadithRecord, 0, len(items))
	for _, item := range items {
		result = append(result, hadithRecord{
			Hadith:       item,
			IsBookmarked: bookmarkedSet[item.ID],
		})
	}
	return result, total, nil
}

func (h *HadithHandler) syncSunnahPage(ctx context.Context, collection string, page int, limit int) error {
	endpoint, err := url.JoinPath(strings.TrimRight(h.cfg.HadithAPIBaseURL, "/"), "hadiths")
	if err != nil {
		return err
	}

	query := url.Values{}
	query.Set("collection", collection)
	query.Set("page", strconv.Itoa(page))
	query.Set("limit", strconv.Itoa(limit))
	fullURL := endpoint + "?" + query.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("X-API-Key", h.cfg.HadithAPIKey)
	request.Header.Set("Accept", "application/json")

	response, err := h.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("sunnah api returned %d", response.StatusCode)
	}

	var payload sunnahHadithListPayload
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return err
	}

	return h.upsertFromSunnah(payload.Data)
}

func (h *HadithHandler) syncSingleFromSource(ctx context.Context, hadithID string) (models.Hadith, error) {
	collection, hadithNumber, err := splitHadithID(hadithID)
	if err != nil {
		return models.Hadith{}, err
	}

	endpoint, err := url.JoinPath(
		strings.TrimRight(h.cfg.HadithAPIBaseURL, "/"),
		"collections",
		collection,
		"hadiths",
		hadithNumber,
	)
	if err != nil {
		return models.Hadith{}, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return models.Hadith{}, err
	}
	request.Header.Set("X-API-Key", h.cfg.HadithAPIKey)
	request.Header.Set("Accept", "application/json")

	response, err := h.httpClient.Do(request)
	if err != nil {
		return models.Hadith{}, err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return models.Hadith{}, fmt.Errorf("sunnah api returned %d", response.StatusCode)
	}

	decoder := json.NewDecoder(response.Body)

	var wrapped sunnahHadithDetailPayload
	if err := decoder.Decode(&wrapped); err == nil && wrapped.Data.Collection != "" {
		if err := h.upsertFromSunnah([]sunnahHadith{wrapped.Data}); err != nil {
			return models.Hadith{}, err
		}
		var record models.Hadith
		if findErr := h.db.Where("id = ?", buildHadithID(collection, hadithNumber)).First(&record).Error; findErr != nil {
			return models.Hadith{}, findErr
		}
		return record, nil
	}

	var direct sunnahHadith
	if err := h.fetchDirectHadith(ctx, endpoint, &direct); err != nil {
		return models.Hadith{}, err
	}

	if err := h.upsertFromSunnah([]sunnahHadith{direct}); err != nil {
		return models.Hadith{}, err
	}

	var record models.Hadith
	if err := h.db.Where("id = ?", buildHadithID(collection, hadithNumber)).First(&record).Error; err != nil {
		return models.Hadith{}, err
	}
	return record, nil
}

func (h *HadithHandler) fetchDirectHadith(ctx context.Context, endpoint string, out *sunnahHadith) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	request.Header.Set("X-API-Key", h.cfg.HadithAPIKey)
	request.Header.Set("Accept", "application/json")

	response, err := h.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return json.NewDecoder(response.Body).Decode(out)
}

func (h *HadithHandler) upsertFromSunnah(items []sunnahHadith) error {
	if len(items) == 0 {
		return nil
	}

	rows := make([]models.Hadith, 0, len(items))
	for _, item := range items {
		row := mapSunnahHadith(item)
		if row.ID == "" {
			continue
		}
		rows = append(rows, row)
	}

	if len(rows) == 0 {
		return nil
	}

	return h.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"collection":    gorm.Expr("excluded.collection"),
			"book_number":   gorm.Expr("excluded.book_number"),
			"hadith_number": gorm.Expr("excluded.hadith_number"),
			"arab":          gorm.Expr("excluded.arab"),
			"translation":   gorm.Expr("excluded.translation"),
			"grade":         gorm.Expr("excluded.grade"),
			"reference":     gorm.Expr("excluded.reference"),
			"source_url":    gorm.Expr("excluded.source_url"),
			"updated_at":    time.Now(),
		}),
	}).Create(&rows).Error
}

func mapSunnahHadith(item sunnahHadith) models.Hadith {
	collection := strings.ToLower(strings.TrimSpace(item.Collection))
	hadithNumber := strings.TrimSpace(item.HadithNumber)
	bookNumber := strings.TrimSpace(item.BookNumber)

	arab := ""
	translation := ""
	grade := ""

	for _, body := range item.Hadith {
		lang := strings.ToLower(strings.TrimSpace(body.Lang))
		if lang == "ar" && arab == "" {
			arab = strings.TrimSpace(stripHTML(body.Body))
		}
		if lang == "en" && translation == "" {
			translation = strings.TrimSpace(stripHTML(body.Body))
			for _, itemGrade := range body.Grades {
				value := strings.TrimSpace(itemGrade.Grade)
				if value != "" {
					grade = value
					break
				}
			}
		}
	}

	if arab == "" {
		arab = "-"
	}
	if translation == "" {
		translation = "-"
	}

	reference := fmt.Sprintf("%s Book %s, Hadith %s", strings.Title(collection), bookNumber, hadithNumber)
	sourceURL := fmt.Sprintf("https://sunnah.com/%s:%s", collection, hadithNumber)

	return models.Hadith{
		ID:           buildHadithID(collection, hadithNumber),
		Collection:   collection,
		BookNumber:   bookNumber,
		HadithNumber: hadithNumber,
		Arabic:       arab,
		Translation:  translation,
		Grade:        grade,
		Reference:    reference,
		SourceURL:    sourceURL,
	}
}

func stripHTML(value string) string {
	replacer := strings.NewReplacer(
		"<br>", "\n",
		"<br/>", "\n",
		"<br />", "\n",
		"<p>", "",
		"</p>", "\n",
		"&nbsp;", " ",
	)
	return strings.TrimSpace(replacer.Replace(value))
}

func buildHadithID(collection string, hadithNumber string) string {
	return strings.ToLower(strings.TrimSpace(collection)) + ":" + strings.TrimSpace(hadithNumber)
}

func splitHadithID(value string) (collection string, hadithNumber string, err error) {
	parts := strings.SplitN(strings.TrimSpace(value), ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid hadith id")
	}

	collection = strings.TrimSpace(parts[0])
	hadithNumber = strings.TrimSpace(parts[1])
	if collection == "" || hadithNumber == "" {
		return "", "", fmt.Errorf("invalid hadith id")
	}
	return collection, hadithNumber, nil
}

func (h *HadithHandler) canSyncSource() bool {
	return strings.TrimSpace(h.cfg.HadithAPIBaseURL) != "" && strings.TrimSpace(h.cfg.HadithAPIKey) != ""
}

func (h *HadithHandler) loadBookmarkSet(userID string, hadithItems []models.Hadith) (map[string]bool, error) {
	result := make(map[string]bool, len(hadithItems))
	if len(hadithItems) == 0 {
		return result, nil
	}

	ids := make([]string, 0, len(hadithItems))
	for _, item := range hadithItems {
		ids = append(ids, item.ID)
	}

	var bookmarks []models.HadithBookmark
	if err := h.db.Where("user_id = ? AND hadith_id IN ?", userID, ids).Find(&bookmarks).Error; err != nil {
		return nil, err
	}

	for _, item := range bookmarks {
		result[item.HadithID] = true
	}
	return result, nil
}

func (h *HadithHandler) isBookmarked(userID string, hadithID string) (bool, error) {
	var count int64
	if err := h.db.Model(&models.HadithBookmark{}).
		Where("user_id = ? AND hadith_id = ?", userID, hadithID).
		Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

func toHadithDTO(rows []hadithRecord) []hadithDTO {
	out := make([]hadithDTO, 0, len(rows))
	for _, item := range rows {
		out = append(out, hadithDTO{
			ID:           item.ID,
			Collection:   item.Collection,
			BookNumber:   item.BookNumber,
			HadithNumber: item.HadithNumber,
			Arab:         item.Arabic,
			Translation:  item.Translation,
			Grade:        item.Grade,
			Reference:    item.Reference,
			SourceURL:    item.SourceURL,
			IsBookmarked: item.IsBookmarked,
		})
	}
	return out
}

func parsePositiveInt(raw string, fallback int) int {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func clampInt(value int, min int, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

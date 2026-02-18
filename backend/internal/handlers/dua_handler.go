package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"muslimlife/backend/internal/middleware"
	"muslimlife/backend/internal/models"
)

type DuaHandler struct {
	db *gorm.DB
}

func NewDuaHandler(db *gorm.DB) *DuaHandler {
	handler := &DuaHandler{db: db}
	_ = handler.seedDefaultsIfEmpty()
	return handler
}

type duaItem struct {
	ID           string `json:"id"`
	Category     string `json:"category"`
	Title        string `json:"title"`
	Arab         string `json:"arab"`
	Latin        string `json:"latin"`
	Translation  string `json:"translation"`
	Reference    string `json:"reference"`
	SourceName   string `json:"source_name"`
	SourceURL    string `json:"source_url"`
	IsBookmarked bool   `json:"is_bookmarked"`
}

type duaBookmarkRequest struct {
	DuaID    string `json:"dua_id" binding:"required"`
	Bookmark *bool  `json:"bookmark"`
}

type duaRecord struct {
	models.Dua
	IsBookmarked bool `json:"is_bookmarked"`
}

func (h *DuaHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	category := strings.ToLower(strings.TrimSpace(c.Query("category")))
	queryText := strings.TrimSpace(c.Query("q"))

	records, err := h.queryDuas(userID, category, queryText)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load duas"})
		return
	}

	categoryMeta := category
	if categoryMeta == "" {
		categoryMeta = "all"
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toDuaItems(records),
		"meta": gin.H{
			"total":    len(records),
			"category": categoryMeta,
			"query":    queryText,
		},
	})
}

func (h *DuaHandler) Today(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	category := strings.ToLower(strings.TrimSpace(c.Query("category")))
	records, err := h.queryDuas(userID, category, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dua of the day"})
		return
	}

	if len(records) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no dua data available"})
		return
	}

	location := jakartaLocation()
	today := startOfDay(time.Now().In(location))
	daySeed := int(today.Unix() / 86400)
	index := daySeed % len(records)
	if index < 0 {
		index += len(records)
	}

	item := toDuaItems([]duaRecord{records[index]})
	c.JSON(http.StatusOK, gin.H{
		"date": today.Format("2006-01-02"),
		"data": item[0],
	})
}

func (h *DuaHandler) Bookmark(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var request duaBookmarkRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	duaID := strings.TrimSpace(request.DuaID)
	if duaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dua_id"})
		return
	}

	var dua models.Dua
	if err := h.db.Where("id = ?", duaID).First(&dua).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dua not found"})
		return
	}

	next := true
	if request.Bookmark != nil {
		next = *request.Bookmark
	}

	if next {
		row := models.DuaBookmark{
			UserID: userID,
			DuaID:  duaID,
		}
		if err := h.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "dua_id"}},
			DoNothing: true,
		}).Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to bookmark dua"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"dua_id":         duaID,
			"is_bookmarked":  true,
			"bookmark_state": "added",
		})
		return
	}

	if err := h.db.Where("user_id = ? AND dua_id = ?", userID, duaID).Delete(&models.DuaBookmark{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove bookmark"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"dua_id":         duaID,
		"is_bookmarked":  false,
		"bookmark_state": "removed",
	})
}

func (h *DuaHandler) Bookmarks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	rows := make([]duaRecord, 0)
	err := h.db.
		Table("duas d").
		Select(`
			d.id, d.category, d.title, d.arab, d.latin, d.translation, d.reference, d.source_name, d.source_url,
			true as is_bookmarked
		`).
		Joins("inner join dua_bookmarks b on b.dua_id = d.id").
		Where("b.user_id = ?", userID).
		Order("b.created_at desc").
		Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load bookmarks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toDuaItems(rows),
		"meta": gin.H{
			"total": len(rows),
		},
	})
}

func (h *DuaHandler) queryDuas(userID, category, queryText string) ([]duaRecord, error) {
	base := h.db.Model(&models.Dua{})
	if category != "" {
		base = base.Where("lower(category) = ?", category)
	}

	if queryText != "" {
		search := "%" + queryText + "%"
		base = base.Where(
			"title ILIKE ? OR arab ILIKE ? OR latin ILIKE ? OR translation ILIKE ? OR reference ILIKE ?",
			search, search, search, search, search,
		)
	}

	items := make([]models.Dua, 0)
	if err := base.Order("category asc, title asc").Find(&items).Error; err != nil {
		return nil, err
	}

	set, err := h.loadDuaBookmarkSet(userID, items)
	if err != nil {
		return nil, err
	}

	out := make([]duaRecord, 0, len(items))
	for _, item := range items {
		out = append(out, duaRecord{
			Dua:          item,
			IsBookmarked: set[item.ID],
		})
	}

	return out, nil
}

func (h *DuaHandler) loadDuaBookmarkSet(userID string, items []models.Dua) (map[string]bool, error) {
	result := make(map[string]bool, len(items))
	if len(items) == 0 {
		return result, nil
	}

	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}

	bookmarks := make([]models.DuaBookmark, 0)
	if err := h.db.Where("user_id = ? AND dua_id IN ?", userID, ids).Find(&bookmarks).Error; err != nil {
		return nil, err
	}

	for _, item := range bookmarks {
		result[item.DuaID] = true
	}
	return result, nil
}

func toDuaItems(rows []duaRecord) []duaItem {
	out := make([]duaItem, 0, len(rows))
	for _, item := range rows {
		out = append(out, duaItem{
			ID:           item.ID,
			Category:     item.Category,
			Title:        item.Title,
			Arab:         item.Arabic,
			Latin:        item.Latin,
			Translation:  item.Translation,
			Reference:    item.Reference,
			SourceName:   item.SourceName,
			SourceURL:    item.SourceURL,
			IsBookmarked: item.IsBookmarked,
		})
	}
	return out
}

func (h *DuaHandler) seedDefaultsIfEmpty() error {
	var count int64
	if err := h.db.Model(&models.Dua{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	sourceName := "Hisnul Muslim (Fortress of the Muslim) - Sa'id bin Ali bin Wahf Al-Qahtani"
	sourceURL := "https://sunnah.com/hisn"

	rows := []models.Dua{
		{
			ID:          "morning-001",
			Category:    "pagi",
			Title:       "Dzikir Pagi: Perlindungan dari keburukan",
			Arabic:      "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
			Latin:       "A'udzu bi kalimatillahit-tammati min syarri ma khalaq.",
			Translation: "Aku berlindung dengan kalimat-kalimat Allah yang sempurna dari kejahatan makhluk-Nya.",
			Reference:   "HR. Muslim no. 2708",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "morning-002",
			Category:    "pagi",
			Title:       "Dzikir Pagi: Ridha kepada Allah",
			Arabic:      "رَضِيتُ بِاللَّهِ رَبًّا وَبِالإِسْلاَمِ دِينًا وَبِمُحَمَّدٍ نَبِيًّا",
			Latin:       "Radhitu billahi rabban wa bil-islami dinan wa bi Muhammadin nabiyya.",
			Translation: "Aku ridha Allah sebagai Rabb, Islam sebagai agama, dan Muhammad sebagai nabi.",
			Reference:   "HR. Abu Dawud no. 5072",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "petang-001",
			Category:    "petang",
			Title:       "Dzikir Petang: Perlindungan malam",
			Arabic:      "بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ",
			Latin:       "Bismillahilladzi la yadurru ma'asmihi syai'un fil ardhi wa la fis sama'.",
			Translation: "Dengan nama Allah yang bersama nama-Nya tidak ada sesuatu pun membahayakan di bumi dan di langit.",
			Reference:   "HR. Abu Dawud no. 5088",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "tidur-001",
			Category:    "tidur",
			Title:       "Doa Sebelum Tidur",
			Arabic:      "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
			Latin:       "Bismika Allahumma amutu wa ahya.",
			Translation: "Dengan nama-Mu ya Allah aku mati dan aku hidup.",
			Reference:   "HR. Bukhari no. 6324",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "bangun-001",
			Category:    "bangun tidur",
			Title:       "Doa Bangun Tidur",
			Arabic:      "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
			Latin:       "Alhamdulillahil-ladzi ahyana ba'da ma amatana wa ilaihin nusyur.",
			Translation: "Segala puji bagi Allah yang menghidupkan kami setelah mematikan kami, dan kepada-Nya kebangkitan.",
			Reference:   "HR. Bukhari no. 6312",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "rezeki-001",
			Category:    "rezeki",
			Title:       "Doa Memohon Kecukupan Rezeki",
			Arabic:      "اللَّهُمَّ اكْفِنِي بِحَلاَلِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
			Latin:       "Allahummakfini bihalalika 'an haramika wa aghnini bifadhlika 'amman siwak.",
			Translation: "Ya Allah, cukupkan aku dengan yang halal dari-Mu dari yang haram, dan kayakan aku dengan karunia-Mu dari selain-Mu.",
			Reference:   "HR. Tirmidzi no. 3563",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "masjid-001",
			Category:    "masjid",
			Title:       "Doa Masuk Masjid",
			Arabic:      "اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
			Latin:       "Allahummaftah li abwaba rahmatik.",
			Translation: "Ya Allah, bukakan untukku pintu-pintu rahmat-Mu.",
			Reference:   "HR. Muslim no. 713",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "masjid-002",
			Category:    "masjid",
			Title:       "Doa Keluar Masjid",
			Arabic:      "اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
			Latin:       "Allahumma inni as'aluka min fadhlik.",
			Translation: "Ya Allah, sesungguhnya aku memohon karunia-Mu.",
			Reference:   "HR. Muslim no. 713",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "kecemasan-001",
			Category:    "kecemasan",
			Title:       "Doa Saat Sedih dan Gelisah",
			Arabic:      "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
			Latin:       "Hasbunallahu wa ni'mal wakil.",
			Translation: "Cukuplah Allah bagi kami, dan Dia sebaik-baik pelindung.",
			Reference:   "QS. Ali 'Imran: 173",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "perjalanan-001",
			Category:    "perjalanan",
			Title:       "Doa Safar",
			Arabic:      "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ",
			Latin:       "Subhanalladzi sakhkhara lana hadza wa ma kunna lahu muqrinin.",
			Translation: "Maha Suci Allah yang menundukkan ini bagi kami, padahal kami sebelumnya tidak mampu menguasainya.",
			Reference:   "HR. Muslim no. 1342",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "makan-001",
			Category:    "makan",
			Title:       "Doa Sebelum Makan",
			Arabic:      "بِسْمِ اللَّهِ",
			Latin:       "Bismillah.",
			Translation: "Dengan nama Allah.",
			Reference:   "HR. Tirmidzi no. 1858",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
		{
			ID:          "makan-002",
			Category:    "makan",
			Title:       "Doa Setelah Makan",
			Arabic:      "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ",
			Latin:       "Alhamdulillahilladzi ath'amani hadza wa razaqanihi.",
			Translation: "Segala puji bagi Allah yang telah memberiku makan ini dan menganugerahkannya kepadaku.",
			Reference:   "HR. Abu Dawud no. 4023",
			SourceName:  sourceName,
			SourceURL:   sourceURL,
		},
	}

	return h.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(&rows).Error
}

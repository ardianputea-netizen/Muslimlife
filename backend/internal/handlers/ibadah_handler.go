package handlers

import (
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

	"muslimlife/backend/internal/middleware"
	"muslimlife/backend/internal/models"
)

var prayerNames = []string{"subuh", "dzuhur", "ashar", "maghrib", "isya"}

type IbadahHandler struct {
	db         *gorm.DB
	httpClient *http.Client
}

func NewIbadahHandler(db *gorm.DB) *IbadahHandler {
	return &IbadahHandler{
		db: db,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

type monthDay struct {
	Date      string            `json:"date"`
	InMonth   bool              `json:"in_month"`
	Statuses  map[string]string `json:"statuses"`
	DoneCount int               `json:"done_count"`
}

type monthSummary struct {
	Done    int `json:"done"`
	Missed  int `json:"missed"`
	Pending int `json:"pending"`
}

func (h *IbadahHandler) GetPrayerMonth(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	location := jakartaLocation()
	month := parseMonth(c.Query("month"), location)
	firstOfMonth := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, location)
	firstOfNextMonth := firstOfMonth.AddDate(0, 1, 0)

	var checkins []models.PrayerCheckin
	if err := h.db.
		Where("user_id = ? AND date >= ? AND date < ?", userID, firstOfMonth.Format("2006-01-02"), firstOfNextMonth.Format("2006-01-02")).
		Find(&checkins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load checkins"})
		return
	}

	statusMap := toDatePrayerStatusMap(checkins, location)
	weeks := buildMonthMatrix(firstOfMonth, statusMap, location)

	summary := monthSummary{}
	for _, week := range weeks {
		for _, day := range week {
			if !day.InMonth {
				continue
			}
			for _, prayer := range prayerNames {
				switch day.Statuses[prayer] {
				case string(models.PrayerStatusDone):
					summary.Done++
				case string(models.PrayerStatusMissed):
					summary.Missed++
				default:
					summary.Pending++
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"month":   firstOfMonth.Format("2006-01"),
		"weeks":   weeks,
		"summary": summary,
	})
}

type prayerCheckinRequest struct {
	Date       string `json:"date" binding:"required"`
	PrayerName string `json:"prayer_name" binding:"required"`
	Status     string `json:"status" binding:"required"`
}

func (h *IbadahHandler) UpsertPrayerCheckin(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var request prayerCheckinRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	prayerName := strings.ToLower(strings.TrimSpace(request.PrayerName))
	if !isValidPrayer(prayerName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prayer_name"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(request.Status))
	if status != string(models.PrayerStatusDone) && status != string(models.PrayerStatusMissed) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	location := jakartaLocation()
	dateValue, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(request.Date), location)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}
	dateValue = startOfDay(dateValue)

	checkin := models.PrayerCheckin{
		UserID:     userID,
		Date:       dateValue,
		PrayerName: prayerName,
		Status:     models.PrayerStatus(status),
	}

	if err := h.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "date"},
			{Name: "prayer_name"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"status":     checkin.Status,
			"updated_at": time.Now(),
		}),
	}).Create(&checkin).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert checkin"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          checkin.ID,
		"user_id":     checkin.UserID,
		"date":        checkin.Date.Format("2006-01-02"),
		"prayer_name": checkin.PrayerName,
		"status":      checkin.Status,
		"updated_at":  checkin.UpdatedAt,
	})
}

func (h *IbadahHandler) GetPrayerStats(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	rangeDays := parseRangeDays(c.Query("range"))
	location := jakartaLocation()
	today := startOfDay(time.Now().In(location))
	startDate := today.AddDate(0, 0, -(rangeDays - 1))
	endDate := today.AddDate(0, 0, 1)

	var checkins []models.PrayerCheckin
	if err := h.db.
		Where("user_id = ? AND date >= ? AND date < ?", userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).
		Find(&checkins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load stats"})
		return
	}

	statusMap := toDatePrayerStatusMap(checkins, location)
	missed := map[string]int{
		"subuh":   0,
		"dzuhur":  0,
		"ashar":   0,
		"maghrib": 0,
		"isya":    0,
	}

	totalSlots := 0
	doneSlots := 0
	for day := startDate; !day.After(today); day = day.AddDate(0, 0, 1) {
		dateKey := day.Format("2006-01-02")
		dayStatuses := statusMap[dateKey]

		for _, prayer := range prayerNames {
			totalSlots++
			if dayStatuses[prayer] == string(models.PrayerStatusDone) {
				doneSlots++
				continue
			}

			missed[prayer]++
		}
	}

	streak := 0
	for day := today; !day.Before(startDate); day = day.AddDate(0, 0, -1) {
		dateKey := day.Format("2006-01-02")
		dayStatuses := statusMap[dateKey]
		if allPrayerDone(dayStatuses) {
			streak++
			continue
		}
		break
	}

	mostMissedPrayer := ""
	mostMissedCount := -1
	for _, prayer := range prayerNames {
		if missed[prayer] > mostMissedCount {
			mostMissedCount = missed[prayer]
			mostMissedPrayer = prayer
		}
	}

	completionRate := 0.0
	if totalSlots > 0 {
		completionRate = (float64(doneSlots) / float64(totalSlots)) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"range_days":         rangeDays,
		"streak_days":        streak,
		"missed_count":       missed,
		"most_missed_prayer": mostMissedPrayer,
		"completion_rate":    fmt.Sprintf("%.1f", completionRate),
	})
}

type prayerTimesResponse struct {
	Code int `json:"code"`
	Data struct {
		Timings map[string]string `json:"timings"`
		Date    interface{}       `json:"date"`
	} `json:"data"`
}

func (h *IbadahHandler) GetPrayerTimes(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	lat, err := strconv.ParseFloat(strings.TrimSpace(c.Query("lat")), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lat"})
		return
	}

	lng, err := strconv.ParseFloat(strings.TrimSpace(c.Query("lng")), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lng"})
		return
	}

	location := jakartaLocation()
	date := parseDateOrToday(c.Query("date"), location)
	method := c.DefaultQuery("method", "20")
	timezone := parseTimezoneOrDefault(c.Query("timezone"))

	aladhanDate := date.Format("02-01-2006")
	query := url.Values{}
	query.Set("latitude", fmt.Sprintf("%f", lat))
	query.Set("longitude", fmt.Sprintf("%f", lng))
	query.Set("method", method)
	query.Set("timezonestring", timezone)
	endpoint := fmt.Sprintf("https://api.aladhan.com/v1/timings/%s?%s", aladhanDate, query.Encode())

	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare request"})
		return
	}

	response, err := h.httpClient.Do(request)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch prayer times"})
		return
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "prayer times provider error"})
		return
	}

	var payload prayerTimesResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "invalid prayer times response"})
		return
	}

	timings := payload.Data.Timings
	c.JSON(http.StatusOK, gin.H{
		"date": date.Format("2006-01-02"),
		"location": gin.H{
			"lat": lat,
			"lng": lng,
		},
		"prayer_times": map[string]string{
			"subuh":   cleanPrayerTime(timings["Fajr"]),
			"dzuhur":  cleanPrayerTime(timings["Dhuhr"]),
			"ashar":   cleanPrayerTime(timings["Asr"]),
			"maghrib": cleanPrayerTime(timings["Maghrib"]),
			"isya":    cleanPrayerTime(timings["Isha"]),
		},
		"meta": gin.H{
			"provider": "aladhan",
			"method":   method,
			"timezone": timezone,
		},
	})
}

func cleanPrayerTime(value string) string {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return "--:--"
	}

	parts := strings.Fields(clean)
	if len(parts) == 0 {
		return clean
	}

	return parts[0]
}

func buildMonthMatrix(firstOfMonth time.Time, statusMap map[string]map[string]string, location *time.Location) [][]monthDay {
	weekdayOffset := (int(firstOfMonth.Weekday()) + 6) % 7 // Monday = 0
	matrixStart := firstOfMonth.AddDate(0, 0, -weekdayOffset)

	weeks := make([][]monthDay, 0, 6)
	currentWeek := make([]monthDay, 0, 7)

	for i := 0; i < 42; i++ {
		date := matrixStart.AddDate(0, 0, i).In(location)
		dateKey := date.Format("2006-01-02")

		statuses := defaultPrayerStatuses()
		if saved, ok := statusMap[dateKey]; ok {
			for prayer, status := range saved {
				statuses[prayer] = status
			}
		}

		doneCount := 0
		for _, prayer := range prayerNames {
			if statuses[prayer] == string(models.PrayerStatusDone) {
				doneCount++
			}
		}

		currentWeek = append(currentWeek, monthDay{
			Date:      dateKey,
			InMonth:   date.Month() == firstOfMonth.Month(),
			Statuses:  statuses,
			DoneCount: doneCount,
		})

		if len(currentWeek) == 7 {
			weeks = append(weeks, currentWeek)
			currentWeek = make([]monthDay, 0, 7)
		}
	}

	return weeks
}

func toDatePrayerStatusMap(checkins []models.PrayerCheckin, location *time.Location) map[string]map[string]string {
	out := make(map[string]map[string]string, len(checkins))

	for _, item := range checkins {
		dateKey := item.Date.In(location).Format("2006-01-02")

		if _, ok := out[dateKey]; !ok {
			out[dateKey] = defaultPrayerStatuses()
		}

		out[dateKey][item.PrayerName] = string(item.Status)
	}

	return out
}

func defaultPrayerStatuses() map[string]string {
	return map[string]string{
		"subuh":   "pending",
		"dzuhur":  "pending",
		"ashar":   "pending",
		"maghrib": "pending",
		"isya":    "pending",
	}
}

func allPrayerDone(dayStatuses map[string]string) bool {
	for _, prayer := range prayerNames {
		if dayStatuses[prayer] != string(models.PrayerStatusDone) {
			return false
		}
	}
	return true
}

func parseMonth(raw string, location *time.Location) time.Time {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		now := time.Now().In(location)
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	}

	month, err := time.ParseInLocation("2006-01", clean, location)
	if err != nil {
		now := time.Now().In(location)
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	}

	return month
}

func parseDateOrToday(raw string, location *time.Location) time.Time {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return startOfDay(time.Now().In(location))
	}

	parsed, err := time.ParseInLocation("2006-01-02", clean, location)
	if err != nil {
		return startOfDay(time.Now().In(location))
	}

	return startOfDay(parsed)
}

func parseTimezoneOrDefault(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "Asia/Jakarta"
	}

	if _, err := time.LoadLocation(value); err != nil {
		return "Asia/Jakarta"
	}

	return value
}

func parseRangeDays(raw string) int {
	clean := strings.ToLower(strings.TrimSpace(raw))
	if clean == "" {
		return 30
	}

	if !strings.HasSuffix(clean, "d") {
		return 30
	}

	num, err := strconv.Atoi(strings.TrimSuffix(clean, "d"))
	if err != nil || num <= 0 {
		return 30
	}

	if num > 365 {
		return 365
	}

	return num
}

func isValidPrayer(value string) bool {
	for _, prayer := range prayerNames {
		if prayer == value {
			return true
		}
	}
	return false
}

func startOfDay(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, value.Location())
}

func jakartaLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}

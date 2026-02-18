package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"muslimlife/backend/internal/middleware"
	"muslimlife/backend/internal/models"
)

type RamadhanHandler struct {
	db *gorm.DB
}

func NewRamadhanHandler(db *gorm.DB) *RamadhanHandler {
	return &RamadhanHandler{db: db}
}

type ramadhanDay struct {
	Date        string  `json:"date"`
	InMonth     bool    `json:"in_month"`
	Sahur       bool    `json:"sahur"`
	Puasa       bool    `json:"puasa"`
	Tarawih     bool    `json:"tarawih"`
	Sedekah     bool    `json:"sedekah"`
	Notes       *string `json:"notes,omitempty"`
	ActiveItems int     `json:"active_items"`
}

type ramadhanMonthSummary struct {
	ActiveDays      int    `json:"active_days"`
	TotalDays       int    `json:"total_days"`
	CompletionRate  string `json:"completion_rate"`
	TotalChecked    int    `json:"total_checked_items"`
	TotalItemTarget int    `json:"total_item_target"`
}

func (h *RamadhanHandler) GetMonth(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	location := jakartaLocation()
	month := parseMonth(c.Query("month"), location)
	firstOfMonth := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, location)
	firstOfNextMonth := firstOfMonth.AddDate(0, 1, 0)

	var checkins []models.RamadhanCheckin
	if err := h.db.
		Where("user_id = ? AND date >= ? AND date < ?", userID, firstOfMonth.Format("2006-01-02"), firstOfNextMonth.Format("2006-01-02")).
		Find(&checkins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load ramadhan month"})
		return
	}

	byDate := mapRamadhanByDate(checkins, location)
	weeks := buildRamadhanMonthMatrix(firstOfMonth, byDate, location)
	summary := summarizeRamadhanMonth(weeks)

	c.JSON(http.StatusOK, gin.H{
		"month":   firstOfMonth.Format("2006-01"),
		"weeks":   weeks,
		"summary": summary,
	})
}

type ramadhanCheckinRequest struct {
	Date    string  `json:"date" binding:"required"`
	Sahur   bool    `json:"sahur"`
	Puasa   bool    `json:"puasa"`
	Tarawih bool    `json:"tarawih"`
	Sedekah bool    `json:"sedekah"`
	Notes   *string `json:"notes"`
}

func (h *RamadhanHandler) UpsertCheckin(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var request ramadhanCheckinRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	location := jakartaLocation()
	dateValue, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(request.Date), location)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}
	dateValue = startOfDay(dateValue)

	var notes *string
	if request.Notes != nil {
		trimmed := strings.TrimSpace(*request.Notes)
		if trimmed != "" {
			notes = &trimmed
		}
	}

	record := models.RamadhanCheckin{
		UserID:  userID,
		Date:    dateValue,
		Sahur:   request.Sahur,
		Puasa:   request.Puasa,
		Tarawih: request.Tarawih,
		Sedekah: request.Sedekah,
		Notes:   notes,
	}

	if err := h.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "date"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"sahur":      record.Sahur,
			"puasa":      record.Puasa,
			"tarawih":    record.Tarawih,
			"sedekah":    record.Sedekah,
			"notes":      record.Notes,
			"updated_at": time.Now(),
		}),
	}).Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert ramadhan checkin"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         record.ID,
		"user_id":    record.UserID,
		"date":       record.Date.Format("2006-01-02"),
		"sahur":      record.Sahur,
		"puasa":      record.Puasa,
		"tarawih":    record.Tarawih,
		"sedekah":    record.Sedekah,
		"notes":      record.Notes,
		"updated_at": record.UpdatedAt,
	})
}

func (h *RamadhanHandler) GetStats(c *gin.Context) {
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

	var checkins []models.RamadhanCheckin
	if err := h.db.
		Where("user_id = ? AND date >= ? AND date < ?", userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).
		Find(&checkins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load ramadhan stats"})
		return
	}

	byDate := mapRamadhanByDate(checkins, location)

	activeDays := 0
	streakDays := 0
	totalChecked := 0
	itemTotals := map[string]int{
		"sahur":   0,
		"puasa":   0,
		"tarawih": 0,
		"sedekah": 0,
	}

	for day := startDate; !day.After(today); day = day.AddDate(0, 0, 1) {
		dateKey := day.Format("2006-01-02")
		record, ok := byDate[dateKey]
		if !ok {
			continue
		}

		active := false
		if record.Sahur {
			itemTotals["sahur"]++
			totalChecked++
			active = true
		}
		if record.Puasa {
			itemTotals["puasa"]++
			totalChecked++
			active = true
		}
		if record.Tarawih {
			itemTotals["tarawih"]++
			totalChecked++
			active = true
		}
		if record.Sedekah {
			itemTotals["sedekah"]++
			totalChecked++
			active = true
		}

		if active {
			activeDays++
		}
	}

	for day := today; !day.Before(startDate); day = day.AddDate(0, 0, -1) {
		dateKey := day.Format("2006-01-02")
		record, ok := byDate[dateKey]
		if !ok || !isRamadhanDayActive(record) {
			break
		}
		streakDays++
	}

	totalTarget := rangeDays * 4
	completionRate := 0.0
	if totalTarget > 0 {
		completionRate = (float64(totalChecked) / float64(totalTarget)) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"range_days":      rangeDays,
		"active_days":     activeDays,
		"streak_days":     streakDays,
		"total_checked":   totalChecked,
		"total_target":    totalTarget,
		"completion_rate": formatPercent(completionRate),
		"item_totals":     itemTotals,
		"inactive_days":   rangeDays - activeDays,
		"active_day_rate": formatPercent((float64(activeDays) / float64(rangeDays)) * 100),
	})
}

func buildRamadhanMonthMatrix(
	firstOfMonth time.Time,
	byDate map[string]models.RamadhanCheckin,
	location *time.Location,
) [][]ramadhanDay {
	weekdayOffset := (int(firstOfMonth.Weekday()) + 6) % 7
	matrixStart := firstOfMonth.AddDate(0, 0, -weekdayOffset)

	weeks := make([][]ramadhanDay, 0, 6)
	week := make([]ramadhanDay, 0, 7)

	for i := 0; i < 42; i++ {
		date := matrixStart.AddDate(0, 0, i).In(location)
		dateKey := date.Format("2006-01-02")

		cell := ramadhanDay{
			Date:    dateKey,
			InMonth: date.Month() == firstOfMonth.Month(),
		}

		if record, ok := byDate[dateKey]; ok {
			cell.Sahur = record.Sahur
			cell.Puasa = record.Puasa
			cell.Tarawih = record.Tarawih
			cell.Sedekah = record.Sedekah
			cell.Notes = record.Notes
		}

		cell.ActiveItems = countActiveItems(cell)
		week = append(week, cell)

		if len(week) == 7 {
			weeks = append(weeks, week)
			week = make([]ramadhanDay, 0, 7)
		}
	}

	return weeks
}

func summarizeRamadhanMonth(weeks [][]ramadhanDay) ramadhanMonthSummary {
	activeDays := 0
	totalDays := 0
	totalChecked := 0

	for _, week := range weeks {
		for _, day := range week {
			if !day.InMonth {
				continue
			}

			totalDays++
			totalChecked += day.ActiveItems
			if day.ActiveItems > 0 {
				activeDays++
			}
		}
	}

	target := totalDays * 4
	completionRate := 0.0
	if target > 0 {
		completionRate = (float64(totalChecked) / float64(target)) * 100
	}

	return ramadhanMonthSummary{
		ActiveDays:      activeDays,
		TotalDays:       totalDays,
		CompletionRate:  formatPercent(completionRate),
		TotalChecked:    totalChecked,
		TotalItemTarget: target,
	}
}

func mapRamadhanByDate(checkins []models.RamadhanCheckin, location *time.Location) map[string]models.RamadhanCheckin {
	out := make(map[string]models.RamadhanCheckin, len(checkins))
	for _, item := range checkins {
		out[item.Date.In(location).Format("2006-01-02")] = item
	}
	return out
}

func countActiveItems(day ramadhanDay) int {
	total := 0
	if day.Sahur {
		total++
	}
	if day.Puasa {
		total++
	}
	if day.Tarawih {
		total++
	}
	if day.Sedekah {
		total++
	}
	return total
}

func isRamadhanDayActive(item models.RamadhanCheckin) bool {
	return item.Sahur || item.Puasa || item.Tarawih || item.Sedekah
}

func formatPercent(value float64) string {
	return fmt.Sprintf("%.1f", value)
}

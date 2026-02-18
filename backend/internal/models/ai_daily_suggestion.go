package models

import (
	"time"

	"github.com/google/uuid"
)

type AIDailySuggestion struct {
	ID                string     `gorm:"type:uuid;primaryKey" json:"id"`
	UserID            string     `gorm:"type:varchar(128);not null;index:idx_ai_daily_user_date,unique" json:"user_id"`
	Date              time.Time  `gorm:"type:date;not null;index:idx_ai_daily_user_date,unique" json:"date"`
	SuggestionVersion int        `gorm:"not null;default:0" json:"suggestion_version"`
	RefreshUsed       int        `gorm:"not null;default:0" json:"refresh_used"`
	DoaID             string     `gorm:"type:varchar(128);not null" json:"doa_id"`
	DzikirID          string     `gorm:"type:varchar(128);not null" json:"dzikir_id"`
	HadithID          *string    `gorm:"type:varchar(128)" json:"hadith_id"`
	Explanation       string     `gorm:"type:text;not null" json:"explanation"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (AIDailySuggestion) TableName() string {
	return "ai_daily_suggestions"
}

func (a *AIDailySuggestion) BeforeCreate() error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	return nil
}

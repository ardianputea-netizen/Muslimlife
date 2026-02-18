package models

import (
	"time"

	"github.com/google/uuid"
)

type PrayerStatus string

const (
	PrayerStatusDone   PrayerStatus = "done"
	PrayerStatusMissed PrayerStatus = "missed"
)

type PrayerCheckin struct {
	ID         string       `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     string       `gorm:"type:varchar(128);not null;index:idx_user_date_prayer,unique" json:"user_id"`
	Date       time.Time    `gorm:"type:date;not null;index:idx_user_date_prayer,unique" json:"date"`
	PrayerName string       `gorm:"type:varchar(16);not null;index:idx_user_date_prayer,unique" json:"prayer_name"`
	Status     PrayerStatus `gorm:"type:varchar(16);not null" json:"status"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

func (PrayerCheckin) TableName() string {
	return "prayer_checkins"
}

func (p *PrayerCheckin) BeforeCreate() error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	return nil
}

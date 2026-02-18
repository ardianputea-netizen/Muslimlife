package models

import (
	"time"

	"github.com/google/uuid"
)

type RamadhanCheckin struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    string    `gorm:"type:varchar(128);not null;index:idx_ramadhan_user_date,unique" json:"user_id"`
	Date      time.Time `gorm:"type:date;not null;index:idx_ramadhan_user_date,unique" json:"date"`
	Sahur     bool      `gorm:"not null;default:false" json:"sahur"`
	Puasa     bool      `gorm:"not null;default:false" json:"puasa"`
	Tarawih   bool      `gorm:"not null;default:false" json:"tarawih"`
	Sedekah   bool      `gorm:"not null;default:false" json:"sedekah"`
	Notes     *string   `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (RamadhanCheckin) TableName() string {
	return "ramadhan_checkins"
}

func (r *RamadhanCheckin) BeforeCreate() error {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	return nil
}

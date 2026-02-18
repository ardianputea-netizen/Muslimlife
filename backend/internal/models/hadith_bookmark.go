package models

import (
	"time"

	"github.com/google/uuid"
)

type HadithBookmark struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    string    `gorm:"type:varchar(128);not null;index:idx_hadith_bookmark_user,unique" json:"user_id"`
	HadithID  string    `gorm:"type:varchar(128);not null;index:idx_hadith_bookmark_user,unique" json:"hadith_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (HadithBookmark) TableName() string {
	return "hadith_bookmarks"
}

func (h *HadithBookmark) BeforeCreate() error {
	if h.ID == "" {
		h.ID = uuid.NewString()
	}
	return nil
}

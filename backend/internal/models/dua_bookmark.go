package models

import "time"

type DuaBookmark struct {
	UserID    string    `gorm:"type:varchar(128);not null;index:idx_dua_bookmark_user,unique" json:"user_id"`
	DuaID     string    `gorm:"type:varchar(128);not null;index:idx_dua_bookmark_user,unique" json:"dua_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (DuaBookmark) TableName() string {
	return "dua_bookmarks"
}

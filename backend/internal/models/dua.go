package models

import "time"

type Dua struct {
	ID          string    `gorm:"type:varchar(128);primaryKey" json:"id"`
	Category    string    `gorm:"type:varchar(64);not null;index:idx_dua_category" json:"category"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Arabic      string    `gorm:"type:text;not null" json:"arab"`
	Latin       string    `gorm:"type:text;not null" json:"latin"`
	Translation string    `gorm:"type:text;not null" json:"translation"`
	Reference   string    `gorm:"type:text;not null" json:"reference"`
	SourceName  string    `gorm:"type:varchar(255);not null" json:"source_name"`
	SourceURL   string    `gorm:"type:text;not null" json:"source_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Dua) TableName() string {
	return "duas"
}

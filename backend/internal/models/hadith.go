package models

import "time"

type Hadith struct {
	ID           string    `gorm:"type:varchar(128);primaryKey" json:"id"`
	Collection   string    `gorm:"type:varchar(64);not null;index:idx_hadith_collection" json:"collection"`
	BookNumber   string    `gorm:"type:varchar(32);not null" json:"book_number"`
	HadithNumber string    `gorm:"type:varchar(32);not null;index:idx_hadith_collection_number,unique" json:"hadith_number"`
	Arabic       string    `gorm:"type:text;not null" json:"arab"`
	Translation  string    `gorm:"type:text;not null" json:"translation"`
	Grade        string    `gorm:"type:varchar(128)" json:"grade"`
	Reference    string    `gorm:"type:text;not null" json:"reference"`
	SourceURL    string    `gorm:"type:text;not null" json:"source_url"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (Hadith) TableName() string {
	return "hadith"
}

package user

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleSuperAdmin Role = "super_admin"
	RoleModerator  Role = "moderator"
	RoleEditor     Role = "editor"
	RoleSubscriber Role = "subscriber"
	RoleGuest      Role = "guest"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Role         Role      `gorm:"type:varchar(20);not null;default:'guest'" json:"role"`
	Name         string    `gorm:"type:varchar(255)" json:"name"`
	Institution  string    `gorm:"type:varchar(255)" json:"institution"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `gorm:"default:now()" json:"created_at"`
	UpdatedAt    time.Time `gorm:"default:now()" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

type UserRepository interface {
	Create(user *User) error
	FindByID(id uuid.UUID) (*User, error)
	FindByEmail(email string) (*User, error)
	Update(user *User) error
	Delete(id uuid.UUID) error
	List(filter UserFilter) ([]User, int64, error)
}

type UserFilter struct {
	Role   string
	Search string
	Page   int
	Limit  int
}

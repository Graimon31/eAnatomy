package repository

import (
	"strings"

	"github.com/google/uuid"
	"github.com/graimon31/eanatomy/internal/domain/user"
	"gorm.io/gorm"
)

// escapeLike escapes SQL LIKE wildcards in user-provided search input.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(u *user.User) error {
	return r.db.Create(u).Error
}

func (r *UserRepo) FindByID(id uuid.UUID) (*user.User, error) {
	var u user.User
	if err := r.db.Where("id = ?", id).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) FindByEmail(email string) (*user.User, error) {
	var u user.User
	if err := r.db.Where("email = ?", email).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) Update(u *user.User) error {
	return r.db.Save(u).Error
}

func (r *UserRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&user.User{}, "id = ?", id).Error
}

func (r *UserRepo) List(filter user.UserFilter) ([]user.User, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	query := r.db.Model(&user.User{})

	if filter.Role != "" {
		query = query.Where("role = ?", filter.Role)
	}
	if filter.Search != "" {
		search := "%" + escapeLike(filter.Search) + "%"
		query = query.Where("email LIKE ? OR name LIKE ?", search, search)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []user.User
	offset := (filter.Page - 1) * filter.Limit
	if err := query.Offset(offset).Limit(filter.Limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

var _ user.UserRepository = (*UserRepo)(nil)

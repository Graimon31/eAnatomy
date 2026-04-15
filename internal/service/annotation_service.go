package service

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/graimon31/eanatomy/internal/domain/annotation"
	"github.com/graimon31/eanatomy/internal/search"
)

var (
	ErrTermNotFound       = errors.New("term not found")
	ErrAnnotationNotFound = errors.New("annotation not found")
	ErrCategoryNotFound   = errors.New("category not found")
)

type AnnotationService struct {
	annotationRepo annotation.AnnotationRepository
	termRepo       annotation.AnatomicalTermRepository
	categoryRepo   annotation.TermCategoryRepository
	searchClient   *search.SearchClient
}

func NewAnnotationService(
	annotationRepo annotation.AnnotationRepository,
	termRepo annotation.AnatomicalTermRepository,
	categoryRepo annotation.TermCategoryRepository,
	searchClient *search.SearchClient,
) *AnnotationService {
	return &AnnotationService{
		annotationRepo: annotationRepo,
		termRepo:       termRepo,
		categoryRepo:   categoryRepo,
		searchClient:   searchClient,
	}
}

// Annotations

type CreateAnnotationInput struct {
	SliceID uuid.UUID `json:"slice_id" binding:"required"`
	TermID  uuid.UUID `json:"term_id" binding:"required"`
	X       float64   `json:"x" binding:"required"`
	Y       float64   `json:"y" binding:"required"`
}

type UpdateAnnotationInput struct {
	X      *float64   `json:"x"`
	Y      *float64   `json:"y"`
	TermID *uuid.UUID `json:"term_id"`
}

func (s *AnnotationService) CreateAnnotation(input CreateAnnotationInput, createdBy uuid.UUID) (*annotation.Annotation, error) {
	a := &annotation.Annotation{
		SliceID:   input.SliceID,
		TermID:    input.TermID,
		X:         input.X,
		Y:         input.Y,
		CreatedBy: &createdBy,
	}

	if err := s.annotationRepo.Create(a); err != nil {
		return nil, fmt.Errorf("failed to create annotation: %w", err)
	}

	return a, nil
}

func (s *AnnotationService) UpdateAnnotation(id uuid.UUID, input UpdateAnnotationInput) (*annotation.Annotation, error) {
	a, err := s.annotationRepo.FindByID(id)
	if err != nil {
		return nil, ErrAnnotationNotFound
	}

	if input.X != nil {
		a.X = *input.X
	}
	if input.Y != nil {
		a.Y = *input.Y
	}
	if input.TermID != nil {
		a.TermID = *input.TermID
	}

	if err := s.annotationRepo.Update(a); err != nil {
		return nil, fmt.Errorf("failed to update annotation: %w", err)
	}

	return a, nil
}

func (s *AnnotationService) DeleteAnnotation(id uuid.UUID) error {
	_, err := s.annotationRepo.FindByID(id)
	if err != nil {
		return ErrAnnotationNotFound
	}
	return s.annotationRepo.Delete(id)
}

func (s *AnnotationService) ListBySlice(sliceID uuid.UUID) ([]annotation.Annotation, error) {
	return s.annotationRepo.ListBySliceID(sliceID)
}

func (s *AnnotationService) CopyAnnotations(targetSliceID, sourceSliceID uuid.UUID, createdBy uuid.UUID) error {
	return s.annotationRepo.CopyAnnotations(targetSliceID, sourceSliceID, &createdBy)
}

// Terms

type CreateTermInput struct {
	FmaID        string            `json:"fma_id"`
	Translations map[string]string `json:"translations" binding:"required"`
	CategoryID   *int              `json:"category_id"`
}

type UpdateTermInput struct {
	FmaID        string            `json:"fma_id"`
	Translations map[string]string `json:"translations"`
	CategoryID   *int              `json:"category_id"`
}

func (s *AnnotationService) CreateTerm(input CreateTermInput, createdBy uuid.UUID) (*annotation.AnatomicalTerm, error) {
	transJSON, _ := marshalJSON(input.Translations)

	t := &annotation.AnatomicalTerm{
		FmaID:        input.FmaID,
		Translations: transJSON,
		CategoryID:   input.CategoryID,
		CreatedBy:    &createdBy,
	}

	if err := s.termRepo.Create(t); err != nil {
		return nil, fmt.Errorf("failed to create term: %w", err)
	}

	// Index in MeiliSearch
	if s.searchClient != nil {
		colorHex := ""
		if input.CategoryID != nil {
			cat, _ := s.categoryRepo.FindByID(*input.CategoryID)
			if cat != nil {
				colorHex = cat.ColorHex
			}
		}
		catID := 0
		if input.CategoryID != nil {
			catID = *input.CategoryID
		}
		_ = s.searchClient.IndexTerm(search.TermDocument{
			ID:         t.ID.String(),
			Ru:         input.Translations["ru"],
			En:         input.Translations["en"],
			La:         input.Translations["la"],
			CategoryID: catID,
			ColorHex:   colorHex,
		})
	}

	return t, nil
}

func (s *AnnotationService) UpdateTerm(id uuid.UUID, input UpdateTermInput) (*annotation.AnatomicalTerm, error) {
	t, err := s.termRepo.FindByID(id)
	if err != nil {
		return nil, ErrTermNotFound
	}

	if input.Translations != nil {
		transJSON, _ := marshalJSON(input.Translations)
		t.Translations = transJSON
	}
	if input.FmaID != "" {
		t.FmaID = input.FmaID
	}
	if input.CategoryID != nil {
		t.CategoryID = input.CategoryID
	}

	if err := s.termRepo.Update(t); err != nil {
		return nil, fmt.Errorf("failed to update term: %w", err)
	}

	// Update in MeiliSearch
	if s.searchClient != nil && input.Translations != nil {
		colorHex := ""
		catID := 0
		if t.CategoryID != nil {
			catID = *t.CategoryID
			cat, _ := s.categoryRepo.FindByID(*t.CategoryID)
			if cat != nil {
				colorHex = cat.ColorHex
			}
		}
		_ = s.searchClient.UpdateTerm(search.TermDocument{
			ID:         t.ID.String(),
			Ru:         input.Translations["ru"],
			En:         input.Translations["en"],
			La:         input.Translations["la"],
			CategoryID: catID,
			ColorHex:   colorHex,
		})
	}

	return t, nil
}

func (s *AnnotationService) DeleteTerm(id uuid.UUID) error {
	_, err := s.termRepo.FindByID(id)
	if err != nil {
		return ErrTermNotFound
	}

	if err := s.termRepo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete term: %w", err)
	}

	if s.searchClient != nil {
		_ = s.searchClient.DeleteTerm(id.String())
	}

	return nil
}

func (s *AnnotationService) ListTerms(filter annotation.TermFilter) ([]annotation.AnatomicalTerm, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.termRepo.List(filter)
}

func (s *AnnotationService) ImportTermsCSV(reader io.Reader, createdBy uuid.UUID) (int, error) {
	csvReader := csv.NewReader(reader)

	// Read header
	header, err := csvReader.Read()
	if err != nil {
		return 0, fmt.Errorf("failed to read CSV header: %w", err)
	}

	// Map column names to indices
	colIdx := make(map[string]int)
	for i, col := range header {
		colIdx[col] = i
	}

	var terms []annotation.AnatomicalTerm
	var searchDocs []search.TermDocument
	count := 0

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return count, fmt.Errorf("failed to read CSV row: %w", err)
		}

		translations := make(map[string]string)
		langs := []string{"ru", "en", "la", "de", "fr", "es", "pt", "it", "ja", "zh", "ar", "pl"}
		for _, lang := range langs {
			if idx, ok := colIdx[lang]; ok && idx < len(record) && record[idx] != "" {
				translations[lang] = record[idx]
			}
		}

		transJSON, _ := marshalJSON(translations)

		fmaID := ""
		if idx, ok := colIdx["fma_id"]; ok && idx < len(record) {
			fmaID = record[idx]
		}

		var categoryID *int
		if idx, ok := colIdx["category"]; ok && idx < len(record) && record[idx] != "" {
			// Category should be resolved by name or ID - for now skip
		}

		t := annotation.AnatomicalTerm{
			FmaID:        fmaID,
			Translations: transJSON,
			CategoryID:   categoryID,
			CreatedBy:    &createdBy,
		}
		terms = append(terms, t)

		searchDocs = append(searchDocs, search.TermDocument{
			Ru: translations["ru"],
			En: translations["en"],
			La: translations["la"],
		})

		count++
	}

	if len(terms) > 0 {
		if err := s.termRepo.BulkCreate(terms); err != nil {
			return 0, fmt.Errorf("failed to import terms: %w", err)
		}

		// Update search docs with generated IDs
		if s.searchClient != nil {
			for i, t := range terms {
				if i < len(searchDocs) {
					searchDocs[i].ID = t.ID.String()
				}
			}
			_ = s.searchClient.BulkIndexTerms(searchDocs)
		}
	}

	return count, nil
}

// Categories

func (s *AnnotationService) ListCategories() ([]annotation.TermCategory, error) {
	return s.categoryRepo.List()
}

func (s *AnnotationService) CreateCategory(cat *annotation.TermCategory) error {
	return s.categoryRepo.Create(cat)
}

func (s *AnnotationService) UpdateCategory(cat *annotation.TermCategory) error {
	return s.categoryRepo.Update(cat)
}

func (s *AnnotationService) DeleteCategory(id int) error {
	return s.categoryRepo.Delete(id)
}

// Search

func (s *AnnotationService) SearchTerms(query, lang string, limit int) ([]search.TermDocument, error) {
	if s.searchClient == nil {
		return nil, errors.New("search not available")
	}
	return s.searchClient.Search(query, lang, limit)
}

func (s *AnnotationService) AutocompleteTerms(query, lang string, limit int) ([]search.TermDocument, error) {
	if s.searchClient == nil {
		return nil, errors.New("search not available")
	}
	return s.searchClient.Autocomplete(query, lang, limit)
}

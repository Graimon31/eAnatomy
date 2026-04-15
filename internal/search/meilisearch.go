package search

import (
	"fmt"
	"time"

	"github.com/meilisearch/meilisearch-go"
)

type TermDocument struct {
	ID         string `json:"id"`
	Ru         string `json:"ru"`
	En         string `json:"en"`
	La         string `json:"la"`
	CategoryID int    `json:"category_id"`
	ColorHex   string `json:"color_hex"`
}

const termsIndexUID = "terms"

type SearchClient struct {
	client meilisearch.ServiceManager
}

func NewSearchClient(url, apiKey string) (*SearchClient, error) {
	opts := []meilisearch.Option{}
	if apiKey != "" {
		opts = append(opts, meilisearch.WithAPIKey(apiKey))
	}
	client := meilisearch.New(url, opts...)

	_, err := client.GetIndex(termsIndexUID)
	if err != nil {
		taskInfo, createErr := client.CreateIndex(&meilisearch.IndexConfig{
			Uid:        termsIndexUID,
			PrimaryKey: "id",
		})
		if createErr != nil {
			return nil, fmt.Errorf("meilisearch create index: %w", createErr)
		}
		_, err = client.WaitForTask(taskInfo.TaskUID, 500*time.Millisecond)
		if err != nil {
			return nil, fmt.Errorf("meilisearch wait for index creation: %w", err)
		}
	}

	index := client.Index(termsIndexUID)

	taskInfo, err := index.UpdateSearchableAttributes(&[]string{"ru", "en", "la"})
	if err != nil {
		return nil, fmt.Errorf("meilisearch update searchable attrs: %w", err)
	}
	if _, err := client.WaitForTask(taskInfo.TaskUID, 500*time.Millisecond); err != nil {
		return nil, fmt.Errorf("meilisearch wait for searchable attrs: %w", err)
	}

	filterableAttrs := []interface{}{"category_id"}
	taskInfo, err = index.UpdateFilterableAttributes(&filterableAttrs)
	if err != nil {
		return nil, fmt.Errorf("meilisearch update filterable attrs: %w", err)
	}
	if _, err := client.WaitForTask(taskInfo.TaskUID, 500*time.Millisecond); err != nil {
		return nil, fmt.Errorf("meilisearch wait for filterable attrs: %w", err)
	}

	return &SearchClient{client: client}, nil
}

func primaryKeyOpt() *meilisearch.DocumentOptions {
	pk := "id"
	return &meilisearch.DocumentOptions{PrimaryKey: &pk}
}

func (s *SearchClient) IndexTerm(term TermDocument) error {
	_, err := s.client.Index(termsIndexUID).AddDocuments([]TermDocument{term}, primaryKeyOpt())
	if err != nil {
		return fmt.Errorf("meilisearch index term: %w", err)
	}
	return nil
}

func (s *SearchClient) UpdateTerm(term TermDocument) error {
	_, err := s.client.Index(termsIndexUID).UpdateDocuments([]TermDocument{term}, primaryKeyOpt())
	if err != nil {
		return fmt.Errorf("meilisearch update term: %w", err)
	}
	return nil
}

func (s *SearchClient) DeleteTerm(id string) error {
	_, err := s.client.Index(termsIndexUID).DeleteDocument(id, nil)
	if err != nil {
		return fmt.Errorf("meilisearch delete term %s: %w", id, err)
	}
	return nil
}

func (s *SearchClient) BulkIndexTerms(terms []TermDocument) error {
	_, err := s.client.Index(termsIndexUID).AddDocuments(terms, primaryKeyOpt())
	if err != nil {
		return fmt.Errorf("meilisearch bulk index: %w", err)
	}
	return nil
}

func (s *SearchClient) Search(query, lang string, limit int) ([]TermDocument, error) {
	searchReq := &meilisearch.SearchRequest{
		Limit:                int64(limit),
		AttributesToRetrieve: []string{"id", "ru", "en", "la", "category_id", "color_hex"},
	}
	if lang != "" {
		searchReq.AttributesToSearchOn = []string{lang}
	}

	resp, err := s.client.Index(termsIndexUID).Search(query, searchReq)
	if err != nil {
		return nil, fmt.Errorf("meilisearch search: %w", err)
	}

	return hitsToTerms(resp.Hits), nil
}

func (s *SearchClient) Autocomplete(query, lang string, limit int) ([]TermDocument, error) {
	searchReq := &meilisearch.SearchRequest{
		Limit:                int64(limit),
		AttributesToRetrieve: []string{"id", "ru", "en", "la", "category_id", "color_hex"},
	}
	if lang != "" {
		searchReq.AttributesToSearchOn = []string{lang}
	}

	resp, err := s.client.Index(termsIndexUID).Search(query, searchReq)
	if err != nil {
		return nil, fmt.Errorf("meilisearch autocomplete: %w", err)
	}

	return hitsToTerms(resp.Hits), nil
}

func hitsToTerms(hits meilisearch.Hits) []TermDocument {
	var terms []TermDocument
	if err := hits.Decode(&terms); err != nil {
		// Fallback to manual parsing
		return manualParseHits(hits)
	}
	return terms
}

func manualParseHits(hits meilisearch.Hits) []TermDocument {
	terms := make([]TermDocument, 0, hits.Len())
	for _, hit := range hits {
		var term TermDocument
		if err := hit.Decode(&term); err != nil {
			continue
		}
		terms = append(terms, term)
	}
	return terms
}

func strVal(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

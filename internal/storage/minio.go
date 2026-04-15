package storage

import (
	"bytes"
	"context"
	"fmt"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIOStorage wraps the MinIO client and provides methods for object storage.
type MinIOStorage struct {
	client     *minio.Client
	bucketName string
	useSSL     bool
}

// NewMinIOStorage creates a new MinIO client and ensures the bucket exists.
func NewMinIOStorage(endpoint, accessKey, secretKey, bucketName string, useSSL bool) (*MinIOStorage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client init: %w", err)
	}

	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, fmt.Errorf("minio bucket check: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
	}

	return &MinIOStorage{
		client:     client,
		bucketName: bucketName,
		useSSL:     useSSL,
	}, nil
}

// Upload stores data in the bucket under folder/objectName and returns the full object path.
func (s *MinIOStorage) Upload(ctx context.Context, folder, objectName string, data []byte, contentType string) (string, error) {
	objectPath := folder + "/" + objectName
	reader := bytes.NewReader(data)

	_, err := s.client.PutObject(ctx, s.bucketName, objectPath, reader, int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("minio upload %s: %w", objectPath, err)
	}

	return objectPath, nil
}

// Delete removes a single object from the bucket.
func (s *MinIOStorage) Delete(ctx context.Context, objectPath string) error {
	if err := s.client.RemoveObject(ctx, s.bucketName, objectPath, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("minio delete %s: %w", objectPath, err)
	}
	return nil
}

// DeleteFolder removes all objects whose key starts with the given prefix.
func (s *MinIOStorage) DeleteFolder(ctx context.Context, prefix string) error {
	objectsCh := s.client.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	errCh := s.client.RemoveObjects(ctx, s.bucketName, objectsCh, minio.RemoveObjectsOptions{})
	for removeErr := range errCh {
		if removeErr.Err != nil {
			return fmt.Errorf("minio delete folder %s: %w", prefix, removeErr.Err)
		}
	}
	return nil
}

// GetPublicURL returns a CDN-compatible public URL for the given object path.
func (s *MinIOStorage) GetPublicURL(objectPath string) string {
	scheme := "http"
	if s.useSSL {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, s.client.EndpointURL().Host, s.bucketName, objectPath)
}

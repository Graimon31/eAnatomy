package service

import (
	"encoding/json"

	"gorm.io/datatypes"
)

func marshalJSON(v interface{}) (datatypes.JSON, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(data), nil
}

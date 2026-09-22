#!/bin/bash

echo "🔄 Starting tutorial update..."

# Resolve the absolute path to the directory containing this script
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PPTX_PATH="$PROJECT_DIR/frontend/public/assets/tutorial/slideshow.pptx"
PDF_PATH="$PROJECT_DIR/frontend/public/assets/tutorial/slideshow.pdf"
EXPORT_DIR="$PROJECT_DIR/frontend/public/assets/tutorial/slide"

if [ ! -f "$PPTX_PATH" ]; then
    echo "❌ Error: Could not find slideshow.pptx in frontend/public/assets/tutorial/"
    exit 1
fi

echo "1️⃣ Converting PowerPoint to PDF..."
osascript - "$PPTX_PATH" "$PDF_PATH" << 'EOF'
on run argv
    set pptxPath to POSIX file (item 1 of argv)
    set pdfPath to POSIX file (item 2 of argv)
    tell application "Microsoft PowerPoint"
        activate
        open pptxPath
        save active presentation in pdfPath as save as PDF
        close active presentation saving no
    end tell
end run
EOF

echo "2️⃣ Extracting slides to SVG vectors..."
# Remove old slides
rm -f "$PROJECT_DIR/frontend/public/assets/tutorial/slide-"*.png
rm -f "$PROJECT_DIR/frontend/public/assets/tutorial/slide-"*.svg

# Convert PDF to SVGs page by page
PAGES=$(pdfinfo "$PDF_PATH" | grep Pages | awk '{print $2}')
for i in $(seq 1 $PAGES); do
    pdftocairo -f $i -l $i -svg "$PDF_PATH" "${EXPORT_DIR}-${i}.svg"
done

echo "✅ Success! The tutorial images have been updated."

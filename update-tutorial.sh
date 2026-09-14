#!/bin/bash

echo "🔄 Starting tutorial update..."
PPTX_PATH="/Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slideshow.pptx"
PDF_PATH="/Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slideshow.pdf"
EXPORT_DIR="/Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slide"

if [ ! -f "$PPTX_PATH" ]; then
    echo "❌ Error: Could not find slideshow.pptx in frontend/public/assets/tutorial/"
    exit 1
fi

echo "1️⃣ Converting PowerPoint to PDF..."
cat << 'EOF' > /tmp/convert.scpt
set pptxPath to POSIX file "/Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slideshow.pptx"
set pdfPath to POSIX file "/Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slideshow.pdf"
tell application "Microsoft PowerPoint"
    activate
    open pptxPath
    save active presentation in pdfPath as save as PDF
    close active presentation saving no
end tell
EOF
osascript /tmp/convert.scpt

echo "2️⃣ Extracting slides to SVG vectors..."
# Remove old slides
rm -f /Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slide-*.png
rm -f /Users/davidzapata/Documents/GitHub/HeatTransPlan/frontend/public/assets/tutorial/slide-*.svg

# Convert PDF to SVGs page by page
PAGES=$(pdfinfo "$PDF_PATH" | grep Pages | awk '{print $2}')
for i in $(seq 1 $PAGES); do
    pdftocairo -f $i -l $i -svg "$PDF_PATH" "${EXPORT_DIR}-${i}.svg"
done

echo "✅ Success! The tutorial images have been updated."

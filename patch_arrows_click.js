const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/map/MapViewer.tsx', 'utf8');

const targetStr = `const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: \`<svg width="\${svgW}" height="\${svgH}" viewBox="0 0 \${svgW} \${svgH}">\${arrowParts.join('')}</svg>\`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH / 2], // Center exactly on the process node!
        });`;

const replacement = `const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: \`<style>.stream-arrows-icon { background: none; border: none; pointer-events: none !important; } .stream-arrows-icon .stream-arrow { pointer-events: auto !important; }</style><svg width="\${svgW}" height="\${svgH}" viewBox="0 0 \${svgW} \${svgH}">\${arrowParts.join('')}</svg>\`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH / 2],
        });`;

if (content.includes(targetStr)) {
  const finalContent = content.replace(targetStr, replacement);
  fs.writeFileSync('frontend/src/components/map/MapViewer.tsx', finalContent);
  console.log("Patched MapViewer.tsx");
} else {
  console.error("Could not find target string in MapViewer.tsx");
}

const fs = require('fs');
const path = require('path');

const illustrations = [
  { name: 'scanner', title: 'Opportunity Scanner' },
  { name: 'paper-trading', title: 'Paper Trading' },
  { name: 'analytics', title: 'Analytics' },
  { name: 'ki-chat', title: 'KI Intelligence' },
  { name: 'risk-management', title: 'Risk Management' },
  { name: 'journal', title: 'Trade Journal' },
];

const svgTemplate = (name, title) => `<svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="url(#gradient)" />
  <text x="200" y="150" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
  <circle cx="200" cy="150" r="30" fill="#3B82F6" />
  <text x="200" y="155" font-size="10" fill="#ffffff" text-anchor="middle">${name}</text>
</svg>`;

const outputDir = path.join(__dirname, '../public/illustrations');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

illustrations.forEach(({ name, title }) => {
  const svgContent = svgTemplate(name, title);
  const filePath = path.join(outputDir, `${name}.svg`);
  fs.writeFileSync(filePath, svgContent);
  console.log(`Generated ${filePath}`);
});

console.log('\nDone! Generated SVG illustrations.');
console.log('For PNG files, open each SVG in a browser and use "Save as PNG" from dev tools.');
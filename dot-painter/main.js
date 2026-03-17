const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const scatterBtn = document.getElementById('scatterBtn');
const exportBtn = document.getElementById('exportBtn');
const spreadRange = document.getElementById('spreadRange');
const densityRange = document.getElementById('densityRange');
const spreadVal = document.getElementById('spreadVal');
const densityVal = document.getElementById('densityVal');

// State
let isDrawing = false;
let lines = []; // Array of lines, where a line is an array of {x, y} points
let currentLine = [];
let scatteredDots = [];

// Configurations
const drawingColor = '#f8fafc';
const dotColor = '#3b82f6';
const dotRadius = 1.5;
const lineThickness = 3;

// Set up canvas context for drawing
ctx.strokeStyle = drawingColor;
ctx.lineWidth = lineThickness;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Event Listeners for Drawing
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Control Buttons & Inputs
clearBtn.addEventListener('click', clearCanvas);
scatterBtn.addEventListener('click', scatterLines);
exportBtn.addEventListener('click', exportJSON);

spreadRange.addEventListener('input', (e) => {
    spreadVal.textContent = e.target.value;
});
densityRange.addEventListener('input', (e) => {
    densityVal.textContent = e.target.value;
});

// Functions

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function startDrawing(e) {
    isDrawing = true;
    currentLine = [];
    const pos = getMousePos(e);
    currentLine.push(pos);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    currentLine.push(pos);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentLine.length > 0) {
        lines.push([...currentLine]);
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lines = [];
    currentLine = [];
    scatteredDots = [];
    exportBtn.disabled = true;
}

// Math Utility: Interpolate points between two segments
function interpolatePoints(p1, p2, spacing = 5) {
    const points = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return [p1];

    const steps = Math.floor(distance / spacing);

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({
            x: p1.x + dx * t,
            y: p1.y + dy * t
        });
    }

    return points;
}

// Generate random points around a center point (Gaussian-like distribution approximation)
function generateDotsAroundPoint(center, dotCount = 3, spread = 15) {
    const dots = [];
    for (let i = 0; i < dotCount; i++) {
        // Random angle
        const angle = Math.random() * Math.PI * 2;
        // Random distance, favoring points closer to center (square root)
        const distance = Math.sqrt(Math.random()) * spread;

        dots.push({
            x: center.x + Math.cos(angle) * distance,
            y: center.y + Math.sin(angle) * distance
        });
    }
    return dots;
}

function scatterLines() {
    if (lines.length === 0) return;

    scatteredDots = [];

    const spread = parseInt(spreadRange.value, 10);
    const density = parseInt(densityRange.value, 10);

    // Process all drawn lines
    lines.forEach(line => {
        if (line.length < 2) {
            // Add dots for a single click
            scatteredDots.push(...generateDotsAroundPoint(line[0], density * 3, spread));
            return;
        }

        // Go through segments
        for (let i = 0; i < line.length - 1; i++) {
            const p1 = line[i];
            const p2 = line[i + 1];

            // Interpolate points along the segment to ensure continuous coverage
            const interpolated = interpolatePoints(p1, p2, 4); // Spacing of 4 pixels

            // Generate scatter points around each interpolated point
            interpolated.forEach(point => {
                // Use user-defined density and spread parameters
                scatteredDots.push(...generateDotsAroundPoint(point, density, spread));
            });
        }
    });

    // Clear canvas and draw only the dots
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw dots
    ctx.fillStyle = dotColor;
    // adding some opacity to dense overlapping areas for a cooler effect
    ctx.globalAlpha = 0.6;

    scatteredDots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Reset alpha and drawing properties for future lines
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = drawingColor;
    // Clear the lines so you can't scatter the same lines multiple times
    lines = [];

    // Enable export button since we have data
    exportBtn.disabled = false;
}

function exportJSON() {
    if (scatteredDots.length === 0) return;

    // Format data beautifully
    const dataStr = JSON.stringify({ dots: scatteredDots }, null, 2);

    // Create Blob and Download Link
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `scattered_dots_${Date.now()}.json`;

    // Append to body, click, and remove
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up URL object
    URL.revokeObjectURL(url);
}

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const scatterBtn = document.getElementById('scatterBtn');
const exportBtn = document.getElementById('exportBtn');
const spreadRange = document.getElementById('spreadRange');
const densityRange = document.getElementById('densityRange');
const spreadVal = document.getElementById('spreadVal');
const densityVal = document.getElementById('densityVal');
const filenameInput = document.getElementById('filenameInput');
const toolBtns = document.querySelectorAll('.tool-btn');

// State
let isDrawing = false;
let currentTool = 'freehand';
let lines = []; // Original drawn lines
let currentLine = [];
let scatteredDots = [];
let isScattered = false; // Track if we are currently displaying dots instead of lines

// Active Shape State
let activeShape = null; // { tool, cx, cy, radius, rotation }
let dragMode = null; // 'move', 'scale', 'rotate'
let dragStartPos = null;
let dragShapeStart = null;

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

// Tool Selection
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (activeShape) stampActiveShape();

        // Update active class
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Set current tool
        currentTool = btn.dataset.tool;
    });
});

// Window keydown for Stamp hotkey and Undo
window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && activeShape) {
        stampActiveShape();
    }

    // Command+Z (Mac) or Ctrl+Z (Windows)
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoLastAction();
    }
});

// Control Buttons & Inputs
clearBtn.addEventListener('click', clearCanvas);
undoBtn.addEventListener('click', undoLastAction);
scatterBtn.addEventListener('click', scatterLines);
exportBtn.addEventListener('click', exportJSON);

// Functions

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function startDrawing(e) {
    // If we were showing scattered dots, clear them and restore original lines before continuing to draw
    if (isScattered) {
        isScattered = false;
        scatteredDots = [];
        redrawOriginalLines();
    }

    const pos = getMousePos(e);

    if (currentTool === 'freehand') {
        if (activeShape) stampActiveShape();

        isDrawing = true;
        currentLine = [];
        currentLine.push(pos);

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    } else {
        // Interaction with active shape
        if (activeShape) {
            // Hit tests
            const scaleHandle = getScaleHandlePos(activeShape);
            const rotateHandle = getRotateHandlePos(activeShape);

            if (distanceBetween(pos, scaleHandle) < 10) {
                dragMode = 'scale';
            } else if (distanceBetween(pos, rotateHandle) < 10) {
                dragMode = 'rotate';
            } else if (distanceBetween(pos, { x: activeShape.cx, y: activeShape.cy }) < activeShape.radius) {
                dragMode = 'move';
            } else {
                // Clicked outside the shape -> stamp and create new
                stampActiveShape();
                activeShape = { tool: currentTool, cx: pos.x, cy: pos.y, radius: 40, rotation: 0 };
                dragMode = 'move'; // Immediately map right after creating
            }
        } else {
            // Spawning a new shape
            activeShape = { tool: currentTool, cx: pos.x, cy: pos.y, radius: 40, rotation: 0 };
            dragMode = 'move';
        }

        dragStartPos = pos;
        if (activeShape) {
            dragShapeStart = { ...activeShape };
        }
        redrawOriginalLines();
    }
}

function draw(e) {
    const pos = getMousePos(e);

    if (currentTool === 'freehand' && isDrawing) {
        currentLine.push(pos);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (activeShape && dragMode) {
        // Handle dragging operations for shape
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;

        if (dragMode === 'move') {
            activeShape.cx = dragShapeStart.cx + dx;
            activeShape.cy = dragShapeStart.cy + dy;
        } else if (dragMode === 'scale') {
            // Use distance from center to control radius
            const newRadius = distanceBetween({ x: activeShape.cx, y: activeShape.cy }, pos) / Math.SQRT2; // Adjust since corner is further
            activeShape.radius = Math.max(10, newRadius); // Min size constraint
        } else if (dragMode === 'rotate') {
            // Find angle relative to center
            const center = { x: activeShape.cx, y: activeShape.cy };
            let angle = Math.atan2(pos.y - center.y, pos.x - center.x) + Math.PI / 2;
            activeShape.rotation = angle;
        }
        redrawOriginalLines();
    }
}

function stopDrawing() {
    if (isDrawing && currentTool === 'freehand') {
        isDrawing = false;
        if (currentLine.length > 0) {
            lines.push([...currentLine]);
        }
    } else if (activeShape && dragMode) {
        dragMode = null;
    }
}

function stampActiveShape() {
    if (!activeShape) return;
    const shapePath = generateShapePath(activeShape.tool, activeShape, activeShape.radius, activeShape.rotation);
    if (shapePath.length > 0) lines.push(shapePath);
    activeShape = null;
    redrawOriginalLines();

    if (spreadRange.value && isScattered === false && scatteredDots.length > 0) {
        scatterLines();
    }
}

// Math Utility Functions
function distanceBetween(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function rotatePoint(x, y, cx, cy, angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const px = x - cx;
    const py = y - cy;
    return {
        x: px * c - py * s + cx,
        y: px * s + py * c + cy
    };
}

function getScaleHandlePos(shape) {
    // Bottom right corner of the bounding box
    return rotatePoint(shape.cx + shape.radius, shape.cy + shape.radius, shape.cx, shape.cy, shape.rotation);
}

function getRotateHandlePos(shape) {
    // Stick poking out of the top
    return rotatePoint(shape.cx, shape.cy - shape.radius - 20, shape.cx, shape.cy, shape.rotation);
}

function generateShapePath(tool, center, size, rotation) {
    const path = [];
    const cx = center.cx;
    const cy = center.cy;

    if (tool === 'square') {
        const half = size;
        path.push(rotatePoint(cx - half, cy - half, cx, cy, rotation)); // Top Left
        path.push(rotatePoint(cx + half, cy - half, cx, cy, rotation)); // Top Right
        path.push(rotatePoint(cx + half, cy + half, cx, cy, rotation)); // Bottom Right
        path.push(rotatePoint(cx - half, cy + half, cx, cy, rotation)); // Bottom Left
        path.push(rotatePoint(cx - half, cy - half, cx, cy, rotation)); // Close
    }
    else if (tool === 'circle') {
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            path.push(rotatePoint(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size, cx, cy, rotation));
        }
    }
    else if (tool === 'triangle') {
        path.push(rotatePoint(cx, cy - size, cx, cy, rotation)); // Top
        path.push(rotatePoint(cx + size, cy + size * 0.8, cx, cy, rotation)); // BR
        path.push(rotatePoint(cx - size, cy + size * 0.8, cx, cy, rotation)); // BL
        path.push(rotatePoint(cx, cy - size, cx, cy, rotation)); // Close
    }
    else if (tool === 'star') {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size * 0.4;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        path.push(rotatePoint(cx, cy - outerRadius, cx, cy, rotation));
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            path.push(rotatePoint(x, y, cx, cy, rotation));
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            path.push(rotatePoint(x, y, cx, cy, rotation));
            rot += step;
        }
        path.push(rotatePoint(cx, cy - outerRadius, cx, cy, rotation));
    }
    return path;
}

function redrawOriginalLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = drawingColor;
    ctx.globalAlpha = 1.0;

    lines.forEach(line => {
        if (line.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) {
            ctx.lineTo(line[i].x, line[i].y);
        }
        ctx.stroke();
    });

    // Draw the active shape OVER the existing lines
    if (activeShape && !isScattered) {
        drawActiveShapeHandles(activeShape);
    }
}

function drawActiveShapeHandles(shape) {
    ctx.save();

    // 1. Draw the actual shape preview
    const path = generateShapePath(shape.tool, shape, shape.radius, shape.rotation);
    if (path.length > 0) {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2; // slightly thinner for preview
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
    }

    // 2. Draw Bounding Box & Handles
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // Dashed bounding box

    // Convert corners
    const tl = rotatePoint(shape.cx - shape.radius, shape.cy - shape.radius, shape.cx, shape.cy, shape.rotation);
    const tr = rotatePoint(shape.cx + shape.radius, shape.cy - shape.radius, shape.cx, shape.cy, shape.rotation);
    const br = rotatePoint(shape.cx + shape.radius, shape.cy + shape.radius, shape.cx, shape.cy, shape.rotation);
    const bl = rotatePoint(shape.cx - shape.radius, shape.cy + shape.radius, shape.cx, shape.cy, shape.rotation);

    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Solid styling for handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;

    // Scale Handle (Bottom Right)
    const scaleH = getScaleHandlePos(shape);
    ctx.beginPath();
    ctx.arc(scaleH.x, scaleH.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotate Handle (Top Stick)
    const rm = rotatePoint(shape.cx, shape.cy - shape.radius, shape.cx, shape.cy, shape.rotation);
    const rotateH = getRotateHandlePos(shape);

    ctx.beginPath();
    ctx.moveTo(rm.x, rm.y);
    ctx.lineTo(rotateH.x, rotateH.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rotateH.x, rotateH.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Move Handle (Center point)
    ctx.beginPath();
    ctx.arc(shape.cx, shape.cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function undoLastAction() {
    // If they are currently dragging/editing a shape, undo should just delete that active shape
    if (activeShape) {
        activeShape = null;
        dragMode = null;
        redrawOriginalLines();

        // Return since they didn't commit it to `lines` yet
        return;
    }

    // If they are not editing an active shape, pop the last committed curve/shape from `lines`
    if (lines.length > 0) {
        lines.pop(); // Remove last drawn freehand stroke or stamped shape

        // If they had "Scatter" mode on, we need to completely rescatter to reflect the change
        if (isScattered) {
            scatterLines();
        } else {
            redrawOriginalLines();
        }
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lines = [];
    currentLine = [];
    scatteredDots = [];
    isScattered = false;
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

    if (steps === 0) return [p1];

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

    isScattered = true;
    exportBtn.disabled = false;
}

// Add event listeners so changing sliders automatically updates the scatter if already scattered
spreadRange.addEventListener('input', (e) => {
    spreadVal.textContent = e.target.value;
    if (isScattered) scatterLines();
});
densityRange.addEventListener('input', (e) => {
    densityVal.textContent = e.target.value;
    if (isScattered) scatterLines();
});

function exportJSON() {
    if (scatteredDots.length === 0) return;

    // Format data beautifully
    const dataStr = JSON.stringify({ dots: scatteredDots }, null, 2);

    // Get custom filename
    let filename = filenameInput.value.trim() || 'scattered_dots';
    if (!filename.endsWith('.json')) {
        filename += '.json';
    }

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

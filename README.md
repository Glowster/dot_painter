# dot_painter

An interactive canvas application that lets you casually paint lines and converts them into scattered dot patterns, with the ability to export the dot coordinates as JSON.

## How to Run Locally

This is a vanilla web application (no build step required). There are a few ways to run it:

### Method 1: Python HTTP Server (Recommended)
If you have Python installed, you can spin up a quick local server. Open your terminal, navigate to the project directory, and run:

```bash
cd dot-painter
python3 -m http.server 8080
```
Then, open your browser and navigate to `http://localhost:8080`.

### Method 2: Node.js / npx
If you prefer Node.js, you can use `serve`:

```bash
cd dot-painter
npx serve .
```

### Method 3: Direct File Open
You can simply open the `dot-painter/index.html` file directly in your web browser. However, running through a local server (Method 1 or 2) is highly recommended for the best experience and to avoid potential CORS issues with browser security protocols when saving files.

## Features
- **Canvas Drawing**: Click and drag to draw lines and paths.
- **Scatter Controls**: Adjust the **Spread** (width of the scatter) and **Density** (number of dots).
- **Dot Conversion**: Converts drawn paths into visually pleasing scattered dots along the original trails.
- **JSON Export**: Downloads all calculated dot coordinates directly to your machine.

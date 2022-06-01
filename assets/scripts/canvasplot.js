/*
 * Copyright (c) 2022 Benny Bobaganoosh <thebennybox@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const createCanvasPlot = () => {
    const createImageBufferFromRGBA = (width, height, pixels) => {
	const size = [width, height];
	if (pixels === undefined) {
            pixels = new Array(width * height * 4).fill(0);
	}

	const pixelsIndex = (pos) => (pos[1] * width + pos[0]) * 4;

	// Everything is stored as functions so this can serve as a general
	// interface. For example, a compressed image can implement the same
	// interface and be used in any funciton which accepts an image buffer.
	return {
            /** Size is an array of [width, height] */
            getSize: () => size,
            /** Note this does not check if position is within the bounds of
             * the image. */
            getPixel: (pos) => {
		const off = pixelsIndex(pos);
		return [
                    pixels[off + 0],
                    pixels[off + 1],
                    pixels[off + 2],
                    pixels[off + 3]];
            },
            /** If alpha component is not present, the color is assumed to be
             * opaque. Note this does not check if position is within the bounds of
             * the image. */
            setPixel: (pos, rgba) => {
		const off = pixelsIndex(pos);
		pixels[off + 0] = rgba[0];
		pixels[off + 1] = rgba[1];
		pixels[off + 2] = rgba[2];
		pixels[off + 3] = rgba[3] !== undefined ? rgba[3] : 255;
            },
            getWidth: () => width,
            getHeight: () => height,
	}
    };

    const createImageBufferFromCanvas = (canvas, ctx, canFlush) => {
	const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const width = canvas.width;
	const height = canvas.height;
	const pixels = id.data;

	return {
            ...createImageBufferFromRGBA(width, height, pixels),
            /** Make any changes visible in the associated canvas */
            flush: !canFlush ? undefined : () => ctx.putImageData(id, 0, 0),
	}
    };

    /**
     * Low level graphics system. Main purpose is to provides an
     * implementation-independent function to create a graphics
     * area that can display an array of pixels
     */
    const createSystemGraphics = () => {
	/**
	 * Creates a new canvas element in the DOM. This function has defaults with
	 * explicit pixel rendering in mind, but it's general and should be able to
	 * handle any arbitrary case of canvas creation.
	 */
	const createCanvas = (width, height, scale, parent = document.body, styleFunc = (style) => {
            style.imageRendering = "optimizeSpeed";
            style.imageRendering = "crisp-edges";
            style.imageRendering = "-webkit-optimize-contrast";
            style.imageRendering = "-o-crisp-edges";
            style.imageRendering = "pixelated";
            style["-ms-interpolation-mode"] = "nearest-neighbor";
	}) => {
            const pixels = width * height;
            const maxCanvasPixels = 1e9;
            if (width <= 0 || height <= 0 || scale <= 0 || !Number.isInteger(width)
		|| !Number.isInteger(height) || !Number.isFinite(scale)
		|| pixels >= maxCanvasPixels || (pixels * scale) >= maxCanvasPixels) {
		throw new Error(
                    "Cannot create canvas with given width, height and scale: "
			+ width + ", " + height + ", " + scale);
            }
            const canvas = document.createElement("canvas");

            // Width/height are handled here instead of style function since they
            // are special properties of the canvas.
            canvas.width = width;
            canvas.height = height;

            // devicePixelRatio is deliberately ignored in applying the scale. This
            // way a 2x scaled element will take up 2 logical pixels regardless of
            // the screen DPI. devicePixelRatio can always be explicitly used in the
            // scale parameter if that needs to be considered.
            canvas.style.width = (width * scale) + "px";
            canvas.style.height = (height * scale) + "px";

            styleFunc(canvas.style);
	    if(parent !== null) {
		parent.appendChild(canvas);
	    }
            return canvas;
	}

	return {
            /**
             * Creates a logical screen buffer -- That is, an array where each value
             * maps to a pixel in the canvas. Can be used for drawing in a canvas
             * pixel by pixel.
             *
             * @param width  - Desired output width
             * @param height - Desired output height
             * @param scale  - How many times bigger the output image is relative 
             * to the input data
	     * @param parent - The DOM element to add the canvas to. Use 'null' to
             * not add to DOM
             * @param styleFunc - A function to set the CSS style of the canvas
             */
            createScreenBuffer: (width, height, scale, parent=undefined, styleFunc=undefined) => {
		const canvas = createCanvas(width, height, scale, parent, styleFunc);
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const textHeight = (font, text) => {
                    ctx.font = font;
                    const measure = ctx.measureText(text);
                    return measure.actualBoundingBoxAscent
			- measure.actualBoundingBoxDescent;
		};
		const textWidth = (font, text) => {
                    ctx.font = font;
                    return ctx.measureText(text).width;
		};
		// TODO: Text filling should be refactored so it works independently
		// of whether drawing occurred on the image buffer earlier or later
		const fillText = (font, text, pos, rgba) => {
                    ctx.font = font;
                    ctx.fillStyle = "rgba(" + rgba[0] + "," + rgba[1] + "," + rgba[2] + ",1)";
                    ctx.fillText(text, pos[0], pos[1]);
		};
		return {
                    ...createImageBufferFromCanvas(canvas, ctx, true),
                    /** Returns the scale used by the canvas for drawing */
                    getScale: () => scale,

                    textHeight,
                    textWidth,
                    fillText
		}
            }
	};
    };

    // Library exports
    return {
	createSystemGraphics,
	createImageBufferFromCanvas,
	createImageBufferFromRGBA
    };
};

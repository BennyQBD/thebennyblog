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
 
(() => {
    // This actually works within the color gamut it seems. The only weakness this
    // retains from HSV is the hue isn't colormetric appropriate.
    //
    // The more advanced hsluma3.js computes everything from CIE Lab for even better
    // color precision
    //
    // A different hue equation in and of it self however can probably be simply
    // dropped in place.

    const calcHue = (rgbColor) => {
	const r = rgbColor.R;
	const g = rgbColor.G;
	const b = rgbColor.B;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	// A piecewise hexagon model of color direction. Imagine taking
	// the rgb color cube and rotating it so the black corner is at
	// the bottom and the white corner is at the top. The remaining 6
	// corners project a hexagon; this model maps a single number to
	// somewhere in that hexagon
	let h = 0;
	switch (max) {
	case min: h = 0; break;
	case r: h = (g - b) + d * (g < b ? 6 : 0); h /= 6 * d; break;
	case g: h = (b - r) + d * 2; h /= 6 * d; break;
	case b: h = (r - g) + d * 4; h /= 6 * d; break;
	}
	return h;
    };

    // Converts hue to an RGB vector in the correct color direction
    // The correct final color can be found by (rgb)*A + B for some
    // appropriate A and B, depending on the color model
    const hueToRGB = (hue) => {
	const h = hue*6;
	const x = (1.0 - Math.abs((h % 2) - 1));
	const i = Math.floor(h);
	let r = 0;
	let g = 0;
	let b = 0;
	switch (i % 6) {
	case 0: r = 1, g = x, b = 0; break;
	case 1: r = x, g = 1, b = 0; break;
	case 2: r = 0, g = 1, b = x; break;
	case 3: r = 0, g = x, b = 1; break;
	case 4: r = x, g = 0, b = 1; break;
	case 5: r = 1, g = 0, b = x; break;
	}
	return {
	    R: r,
	    G: g,
	    B: b
	};
    };

    const calcLuma = (r, g, b) => {
	// There's various standards to calculate luma from rgb
	// Any can be uncommented to experiment with how luma
	// behavior changs
	return 0.299*r + 0.587*g + 0.114*b;
	//return 0.2126*r + 0.7152*g + 0.0722*b;
	//return 0.2627*r + 0.6780*g + 0.0593*b;
	//return (r + g + b)/3.0;
    };

    const maxSaturatedColorAtLuma = (h, desiredLuma) => {
	const col = hueToRGB(h);
	let r = col.R;
	let g = col.G;
	let b = col.B;
	const luma = calcLuma(r, g, b);

	// Find maximum saturated color with the final luma
	if(desiredLuma < luma) {
	    // Algebra deriving the equation
	    // A*wr*r+A*wg*g+A*wb*b = desiredLuma
	    // A*(wr*r+wg*g+wb*b) = desiredLuma
	    // A*luma = desiredLuma
	    // A = desiredLuma/luma
	    const A = desiredLuma/luma;
	    r *= A;
	    g *= A;
	    b *= A;
	} else {
	    // Algebra deriving the equation
	    // wr*(A*r+B)+wg*(A*g+B)+wb*(A*b+B) = desiredLuma
	    // wr*A*r+wr*B+wg*A*g+wg*B+wb*A*b+wb*B = desiredLuma
	    // wr*A*r+wg*A*g+wb*A*b + wr*B+wg*B+wb*B = desiredLuma
	    // A*(wr*r+wg*g+wb*b) + wr*B+wg*B+wb*B = desiredLuma
	    // A*luma + B*(wr+wg+wb) = desiredLuma
	    // A*luma + B = desiredLuma
	    // A*luma + (1-A) = desiredLuma
	    // A*luma - A + 1 = desiredLuma
	    // A*(luma - 1) + 1 = desiredLuma
	    // A = (desiredLuma-1)/(luma - 1)
	    const A = (desiredLuma-1)/(luma - 1);
	    r = A * r + (1-A);
	    g = A * g + (1-A);
	    b = A * b + (1-A);
	}

	return {
	    R: r,
	    G: g,
	    B: b
	}
    };

    const HSLumaToRGB = (hsluma) => {
	// Key is to realize the hue color is always at max saturation
	const col = maxSaturatedColorAtLuma(hsluma.H, hsluma.Luma);
	let r = col.R;
	let g = col.G;
	let b = col.B;
	const desiredLuma = hsluma.Luma;

	// Saturation is a linear mix between the grey of the same
	// luma and the maximum saturated luma
	const saturation = hsluma.S;
	r =  r*saturation + desiredLuma * (1.0 - saturation);
	g =  g*saturation + desiredLuma * (1.0 - saturation);
	b =  b*saturation + desiredLuma * (1.0 - saturation);

	return {
	    R: r,
	    G: g,
	    B: b
	}
    };

    const RGBToHSLuma = (rgb) => {
	const h = calcHue(rgb);
	const luma = calcLuma(rgb.R, rgb.G, rgb.B);
	const col = maxSaturatedColorAtLuma(h, luma);
	const ri = col.R;
	const gi = col.G;
	const bi = col.B;
	
	const rf = rgb.R;
	const gf = rgb.G;
	const bf = rgb.B;

	// Algebra deriving the equation
	// b_f =  b_i*s + luma * (1 - s);
	// b_f =  b_i*s + luma - luma*s;
	// b_f =  b_i*s - luma*s + luma;
	// b_f =  s*(b_i - luma) + luma;
	// b_f-luma =  s*(b_i - luma);
	// (b_f - luma)/(b_i - luma) = s;
	
	// In theory these should all be the same number
	const sr = (rf - luma)/(ri - luma);
	const sg = (gf - luma)/(gi - luma);
	const sb = (bf - luma)/(bi - luma);
	const s = (sr + sg + sb)/3.0;

	return {
	    H: h,
	    S: s,
	    Luma: luma
	};
	
    };

    ////////////////////////////////////////////////////////////////////////////////
    // BEGIN BASIC TESTING CODE
    ////////////////////////////////////////////////////////////////////////////////

    // In an ideal world these would be in their own function if not their own file,
    // but this simpler approach works well enough for now.
    
    // Utility for testing
    const torgb = (r, g, b) => ({
	R: r,
	G: g,
	B: b
    });

    const toHSLuma = (h, s, luma) => ({
	H: h,
	S: s,
	Luma: luma
    });
    
    for(let i = 0; i < 100; i++) {
	const col = torgb(Math.random(), Math.random(), Math.random());
	const hsluma = RGBToHSLuma(col);
	const rgb = HSLumaToRGB(hsluma);
	if(Math.abs(rgb.R - col.R) > 1e-4
	   || Math.abs(rgb.G - col.G) > 1e-4
	   || Math.abs(rgb.B - col.B) > 1e-4) {
	    console.log("RGB->HSLuma COLOR DID NOT MATCH!");
	    console.log(col, hsluma, rgb);
	}
	if(hsluma.H < 0 || hsluma.H > 1
	   || hsluma.S < 0 || hsluma.S > 1
	   || hsluma.Luma < 0 || hsluma.Luma > 1
	  ) {
	    console.log("RGB->HSLuma COLOR OUT OF RANGE!");
	    console.log(col, hsluma, rgb);
	}
    }

    for(let i = 0; i < 100; i++) {
	const col = toHSLuma(Math.random(), Math.random(), Math.random());
	const rgb = HSLumaToRGB(col);
	const hsluma = RGBToHSLuma(rgb);
	if(Math.abs(hsluma.H - col.H) > 1e-4
	   || Math.abs(hsluma.S - col.S) > 1e-4
	   || Math.abs(hsluma.Luma - col.Luma) > 1e-4) {
	    console.log("HSLuma->RGB COLOR DID NOT MATCH!");
	    console.log(col, hsluma, rgb);
	}
	if(rgb.R < 0 || rgb.R > 1
	   || rgb.G < 0 || rgb.G > 1
	   || rgb.B < 0 || rgb.B > 1
	  ) {
	    console.log("HSLuma->RGB COLOR OUT OF RANGE!");
	    console.log(col, hsluma, rgb);
	}
    }

    ////////////////////////////////////////////////////////////////////////////////
    // BEGIN COLOR PICKER CODE
    ////////////////////////////////////////////////////////////////////////////////

    const canvasPlot = createCanvasPlot();
    const sysgfx = canvasPlot.createSystemGraphics();
    const screenBuffer = sysgfx.createScreenBuffer(
	256, 256, 1, document.getElementById("hsluma2"));

    const drawHSLuma = (screenBuffer, luma) => {
	const width = screenBuffer.getWidth();
	const height = screenBuffer.getHeight();
	for(let i = 0; i < width; i++) {
	    for(let j = 0; j < height; j++) {
		const h = i/width;
		const s = 1.0 - j/(height - 1);
		const col = HSLumaToRGB(toHSLuma(h, s, luma));
		const rgb = [
		    Math.round(col.R*255.0),
		    Math.round(col.G*255.0),
		    Math.round(col.B*255.0)];
		// grey is only calculated to allow easy comparison
		// of colors with the grey luma in testing
		const rgbLuma = calcLuma(rgb[0], rgb[1], rgb[2]);
		const grey = [rgbLuma, rgbLuma, rgbLuma];
		screenBuffer.setPixel([i, j], rgb);
	    }
	}
	screenBuffer.flush();
    };

    drawHSLuma(screenBuffer, 0.5);
    const slider = document.getElementById("myRange2");
    slider.value = 50;
    slider.oninput = function() {
	drawHSLuma(screenBuffer, this.value/100);
    };
})();


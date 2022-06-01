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
    // Similar to Lch, it allows specifying CIE Lab colors using luminance, hue,
    // and some chroma component.
    // Unlike Lch (but like HSV), it uses a "saturation" value instead of raw
    // chroma so there are no out of gamut colors

    // RGB->Lab & Lab->RGB conversions based on
    // http://www.easyrgb.com/index.php?X=MATH
    const RGBToLab = (rgbColor) => {
	const r = rgbColor.R;
	const g = rgbColor.G;
	const b = rgbColor.B;
	// Convert sRGB to linear RGB
	const r2 = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	const g2 = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	const b2 = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

	// Convert linear RGB to XYZ
	const x = r2 * 0.4124 + g2 * 0.3576 + b2 * 0.1805;
	const y = r2 * 0.2126 + g2 * 0.7152 + b2 * 0.0722;
	const z = r2 * 0.0193 + g2 * 0.1192 + b2 * 0.9505;

	//Normalize XYZ based on standard illuminant D65
	const x2 = x/0.95047;
	const y2 = y;
	const z2 = z/1.08883;

	// Convert XYZ to CIE Lab
	const x3 = x2 > 0.008856 ? Math.pow(x2, 1/3.0) : 7.787 * x2 + 16 / 116;
	const y3 = y2 > 0.008856 ? Math.pow(y2, 1/3.0) : 7.787 * y2 + 16 / 116;
	const z3 = z2 > 0.008856 ? Math.pow(z2, 1/3.0) : 7.787 * z2 + 16 / 116;

	// Finally compute CIE Lab
	const L = 116 * y3 - 16;
	const A = 500 * (x3 - y3);
	const B = 200 * (y3 - z3);

	return {
	    L,
	    a: A,
	    b: B
	};
    };

    const LabToRGB = (labColor) => {
	const L = labColor.L;
	const A = labColor.a;
	const B = labColor.b;

	// Lab to D65 Normalized XYZ
	const y = (L + 16)/116;
	const x = A/500 + y;
	const z = y - B/200;

	const threshold = Math.pow(0.008856, 1/3.0);
	const x2 = x > threshold ? x*x*x : (x - 16 / 116) / 7.787;
	const y2 = y > threshold ? y*y*y : (y - 16 / 116) / 7.787;
	const z2 = z > threshold ? z*z*z : (z - 16 / 116) / 7.787;

	// D65 Normalized XYZ to non-normalized XYZ
	const x3 = x2 * 0.95047;
	const y3 = y2;
	const z3 = z2 * 1.08883;

	// Convert XYZ to linear RGB. The more precise weights are because this is
	// supposed to be the exact inverse of the matrix used in the forward RGB
	// to Lab calculation
	const r = x3 * 3.2406254773200531454 + y3 * -1.5372079722103185961 + z3 * -0.49862859869824785913;
	const g = x3 * -0.96893071472931930199 + y3 * 1.8757560608852411526 + z3 * 0.041517523842953942967;
	const b = x3 * 0.055710120445510610295 + y3 * -0.20402105059848668751 + z3 * 1.0569959422543882942;

	// Convert linear RGB to sRGB
	const r2 = r > 0.0031308 ? (1.055 * Math.pow(r, 1/2.4)) - 0.055 : r * 12.92;
	const g2 = g > 0.0031308 ? (1.055 * Math.pow(g, 1/2.4)) - 0.055 : g * 12.92;
	const b2 = b > 0.0031308 ? (1.055 * Math.pow(b, 1/2.4)) - 0.055 : b * 12.92;

	return {
	    R: r2,
	    G: g2,
	    B: b2
	}
    };

    const toLab = (L, a, b) => ({
	L,
	a,
	b
    });

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

    const hueFromLab = (labColor) => {
	let result = (Math.atan2(labColor.b, labColor.a))/(2.0*Math.PI);
	if(result < 0) {
	    result = result + 1;
	}
	return result;
    };

    const hueToABAngle = (h) => {
	return (h > 0.5 ? (h - 1) : h) * 2.0 * Math.PI;
    }

    const maxSaturatedColorAtLuma = (h, desiredLuma) => {
	const hangle = hueToABAngle(h);
	const L = desiredLuma*100;
	const A = Math.cos(hangle);
	const B = Math.sin(hangle);

	const epsilon = 1e-5;
	let fMin = 0.0;
	let fMax = 1000.0;
	let f = 0;
	let rgbColor = null;
	let labColor = null;
	for(let i = 0; i < 100; i++) {
	    f = (fMax+fMin)/2.0;
	    labColor = toLab(L, A*f, B*f);
	    rgbColor = LabToRGB(labColor);
	    let rgbMax = Math.max(rgbColor.R, rgbColor.G, rgbColor.B);
	    let rgbMin = Math.min(rgbColor.R, rgbColor.G, rgbColor.B);
	    
	    if(rgbMax > 1.0 || rgbMin < 0.0) {
		fMax = f;
	    } else if(Math.abs(rgbMax - 1.0) < epsilon
		      || Math.abs(rgbMin - 0.0) < epsilon) {
		return labColor;
	    } else {
		fMin = f;
	    }
	}

	return labColor;
    };

    const HSLumaToRGB = (hsluma) => {
	const satCol = maxSaturatedColorAtLuma(hsluma.H, hsluma.Luma);
	const finalCol = LabToRGB(toLab(
	    satCol.L, satCol.a*hsluma.S, satCol.b*hsluma.S));
	return {
	    R: Math.min(Math.max(finalCol.R, 0), 1),
	    G: Math.min(Math.max(finalCol.G, 0), 1),
	    B: Math.min(Math.max(finalCol.B, 0), 1),
	};
    };

    const RGBToHSLuma = (rgb) => {
	const labCol = RGBToLab(rgb);
	const luma = labCol.L/100.0;
	const h = hueFromLab(labCol);
	const satCol = maxSaturatedColorAtLuma(h, luma);

	// In theory these should be the same number
	const sa = labCol.a/satCol.a;
	const sb = labCol.b/satCol.b;

	return {
	    H: h,
	    S: (sa + sb)*0.5,
	    Luma: luma
	};
    };

    // Basic testing/verification code
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

    for(let i = 0; i < 100; i++) {
	const col = torgb(Math.random(), Math.random(), Math.random());
	const lab = RGBToLab(col);
	const rgb = LabToRGB(lab);
	if(Math.abs(rgb.R - col.R) > 1e-4
	   || Math.abs(rgb.G - col.G) > 1e-4
	   || Math.abs(rgb.B - col.B) > 1e-4) {
	    console.log("RGB->Lab COLOR DID NOT MATCH!");
	    console.log(col, lab, rgb);
	}
    }

    ////////////////////////////////////////////////////////////////////////////////
    // BEGIN COLOR PICKER CODE
    ////////////////////////////////////////////////////////////////////////////////

    const canvasPlot = createCanvasPlot();
    const sysgfx = canvasPlot.createSystemGraphics();
    const screenBuffer = sysgfx.createScreenBuffer(
	64, 64, 4, document.getElementById("hsluma3"),
	(style) => {});

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
		screenBuffer.setPixel([i, j], rgb);
	    }
	}
	screenBuffer.flush();
    };

    drawHSLuma(screenBuffer, 0.5);
    const slider = document.getElementById("myRange3");
    slider.value = 50;
    slider.oninput = function() {
	drawHSLuma(screenBuffer, this.value/100);
    };
})();


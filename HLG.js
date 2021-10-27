// ITU-R BT.2390-8 p.26
// 6.1 The hybrid log-gamma opto-electronic transfer function (OETF)

function HLG_OETF (E) {
    const a = 0.17883277;
    const b = 1 - (4 * a)
    const c = 0.5 - a * Math.log(4 *a)
    if (E <= 1/12) {
        return Math.sqrt( 3 * E);
    }
    else {
        return a * Math.log(12 * E - b) + c;
    }
}

// ITU-R BT.2390-8 p.33
// 6.3 The hybrid log-gamma electro-optical transfer function (EOTF)
function HLG_inv_OETF (Edash) {
    const a = 0.17883277;
    const b = 1 - (4 * a)
    const c = 0.5 - a * Math.log(4 *a)
    if (Edash <= 0.5) {
        return (Edash ** 2) / 3;
    }
    else {
        return (Math.exp((Edash - c) / a) + b) / 12;
    }
}

// given an array of scene-light-linear RGB values,
// return an array of HLG-encoded RGB values
function toHLG (RGB) {
    return RGB.map(HLG_OETF(E));
}

// given an array of HLG-encoded RGB values,
// return an array of scene-light-linear RGB values
function fromHLG (RGB) {
    return RGB.map(HLG_inv_OETF(Edash));
}

// given overall system gamma (OOTF gamma)
// Lw, the nominal peak luminance of the display in cd/m2
// and Lb the display luminance for black in cd/m2,
// return β the black level lift
// ITU-R BT.2390-8 section
// 6.3 The hybrid log-gamma electro-optical transfer function (EOTF)
// Default gamma is 1.2
// Default white, black values are from VESA DisplayHDR 1.1, Performance Tier 1000
function blackLevelLift (gamma=1.2, Lw=1000, Lb=0.05) {
    return Math.sqrt(3 * Math.pow(Lb / Lw, 1 / gamma));
}

// given Lw, the nominal peak luminance of the display in cd/m2
// return the OOTF reference gamma (for reference viewing environments)
// using the extended model
// ITU-R BT.2390-8 p.31 section
// 6.2 System gamma and the opto-optical transfer function (OOTF)
function extendedGamma (Lw) {
    const k = 1.111;
    let pow = Math.log2(Lw/1000);
    return 1.2 * Math.pow(k, pow);
}

// given refGamma, the system gamma for the reference environment of 5 cd/m2
// and Lamb, the ambient luminance of the actual viewing environment,
// return an adjusted system gamma for that environment
// using the "best fit" model
// because the "alternative model" is underspecified :(
// ITU-R BT.2390-8 p.31 section
function brightGamma (refGamma, Lamb) {
    let adjustment = -0.076 * Math.log10 (Lamb / 5);
    return refGamma - adjustment;
}

// given Edash, an HLG-encoded rec2100 RGB component value in nominal range [0-1]
// and the black level lift needed for a given display,
// and the OOTF gamma needed for a given display peak luminance and ambient lightness,
// return a linear-light rec2100 RGB component value in clamped range [0,1]
// ITU-R BT.2390-8 section
// 6.3 The hybrid log-gamma electro-optical transfer function (EOTF)
function HLG_EOTF (Edash, beta, gamma) {
    let value = (1 - beta) * Edash + beta;
    let value2 = HLG_inv_OETF(Math.max(0, value));
    return HLG_OOTF(value2, gamma);
}

function HLG_inv_EOTF () {
    // umm
}

// convert array of sRGB (or rec709 full-range) in nominal range [0,1]
// to rec2100-hlg
// adapted from https://lists.w3.org/Archives/Public/public-colorweb/2021Sep/0008.html
// uses conversion functions from CSS Color 4
function convertExtendedSRGBtoREC2100HLG(sRGB) {
    // linear-light value of HLG media white = 75IRE
    const SrgbtoHlgScaler = HLG_inv_OETF(0.75);

    // undo sRGB transfer function to yeild linear-light RGB
    let linsRGB = lin_sRGB(sRGB);

    // convert to rec2100 = rec2020 primaries
    // could be done in one step by multiplying the relevant matrices
    let lin2100 = XYZ_to_lin_2020(lin_sRGB_to_XYZ(linsRGB));

    // Scale to HLG output signal range
    let scaled2100 = lin2100.map(c => c * SrgbtoHlgScaler);

    // Convert to HLG Non-linear Signal (straightforward as systemGamma = 1.0)
    // why isn't this the HLG OETF?
    return HLG_inv_EOTF(scaled2100);

    // (r1, g1, b1) = tf.srgb_eotf(R, G, B)  # convert to linear RGB Normalised Display Light (values may be outside range 0 - 1)
    // (r2, g2, b2) = cs.applyMatrix(r1, g1, b1, mat709to2020)  # Convert from BT.709/sRGB Primaries to BT.2100 Primaries
    // r3 = SrgbtoHlgScaler * r2   # Scale to HLG output signal range
    // g3 = SrgbtoHlgScaler * g2
    // b3 = SrgbtoHlgScaler * b2
    // (r4, g4, b4) = tf.hlg_inverse_eotf(r3, g3, b3, systemGamma)  # Convert to HLG Non-linear Signal (straightforward as systemGamma = 1.0)

}
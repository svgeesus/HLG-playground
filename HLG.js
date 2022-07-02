// ITU-R BT.2390-10 p.23
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

// ITU-R BT.2390-10 p.30 section
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
// ITU-R BT.2390-10 p.30 section
// 6.3 The hybrid log-gamma electro-optical transfer function (EOTF)
// Default gamma is 1.2
// Default white, black values are from VESA DisplayHDR 1.1, Performance Tier 1000
function blackLevelLift (gamma=1.2, Lw=1000, Lb=0.05) {
    return Math.sqrt(3 * Math.pow(Lb / Lw, 1 / gamma));
}

// given Lw, the nominal peak luminance of the display in cd/m2
// return the OOTF reference gamma (for reference viewing environments)
// using the extended model
// ITU-R BT.2390-10 p.26 section
// 6.2 System gamma and the opto-optical transfer function (OOTF)
function extendedGamma (Lw=1000) {
    const k = 1.111;
    let pow = Math.log2(Lw/1000);
    return 1.2 * Math.pow(k, pow);
}

// given refGamma, the system gamma for the reference environment of 5 cd/m2
// and Lamb, the ambient luminance of the actual viewing environment,
// return an adjusted system gamma for that environment
// using the "best fit" model
// because the "alternative model" is underspecified :(
// ITU-R BT.2390-10 p.26 section
// 6.2 System gamma and the opto-optical transfer function (OOTF)
function brightGamma (refGamma, Lamb) {
    let adjustment = -0.076 * Math.log10 (Lamb / 5);
    return refGamma - adjustment;
}

// given an array of linear-light rec2100 RGB values
// and an overall system gamma
// apply that gamma to just the luminance
// and return an array of adjusted linear-light RGB values
// ITU-R BT.2390-10 p.26 section
// 6.2 System gamma and the opto-optical transfer function (OOTF)
function HLG_OOTF(RGB, gamma) {
    const toXYZ_M = [
        [ 0.6369580483012914, 0.14461690358620832,  0.1688809751641721  ],
        [ 0.2627002120112671, 0.6779980715188708,   0.05930171646986196 ],
        [ 0.000000000000000,  0.028072693049087428, 1.060985057710791   ]
    ];
    const fromXYZ_M = [
        [  1.716651187971268,  -0.355670783776392, -0.253366281373660  ],
        [ -0.666684351832489,   1.616481236634939,  0.0157685458139111 ],
        [  0.017639857445311,  -0.042770613257809,  0.942103121235474  ]
    ]
    let [X, Y, Z] = multiplyMatrices(toXYZ_M, RGB);
    Y = Y ** gamma;
    return multiplyMatrices(fromXYZ_M, [X, Y, Z]);
}

// given RGB, an array of HLG-encoded rec2100 RGB values in nominal range [0-1]
// and the black level lift needed for a given display,
// and the OOTF gamma needed for a given display peak luminance and ambient lightness,
// return an array of  linear-light rec2100 RGB values in clamped range [0,1]
// ITU-R BT.2390-10 p.30 section
// 6.3 The hybrid log-gamma electro-optical transfer function (EOTF)
function HLG_EOTF (RGB, beta, gamma) {

    // first calculate the linear-light RGB values assuming a system gamma of 1.0
    let RGB2 = RGB.map(function (Edash) {
        let value = (1 - beta) * Edash + beta;
        return HLG_inv_OETF(Math.max(0, value));
    });

    // Now correct for system gamma
    return HLG_OOTF(RGB2, gamma);
}


// convert array of sRGB (or rec709 full-range) in nominal range [0,1]
// to rec2100-hlg
// adapted from https://lists.w3.org/Archives/Public/public-colorweb/2021Sep/0008.html
// uses conversion functions from CSS Color 4

// linear-light value of HLG media white = 75IRE
const SrgbtoHlgScaler = HLG_inv_OETF(0.75);


function convertExtendedSRGBtoREC2100HLG (sRGB) {


    // undo sRGB transfer function to yeild linear-light RGB
    let linsRGB = lin_sRGB(sRGB);

    // convert to rec2100 = rec2020 primaries
    // could be done in one step by multiplying the relevant matrices
    let lin2100 = XYZ_to_lin_2020(lin_sRGB_to_XYZ(linsRGB));

    // Scale to HLG output signal range
    let scaled2100 = lin2100.map(c => c * SrgbtoHlgScaler);

    // Convert to HLG Non-linear Signal (straightforward as systemGamma = 1.0)
    return HLG_inv_EOTF(scaled2100);

    // (r1, g1, b1) = tf.srgb_eotf(R, G, B)  # convert to linear RGB Normalised Display Light (values may be outside range 0 - 1)
    // (r2, g2, b2) = cs.applyMatrix(r1, g1, b1, mat709to2020)  # Convert from BT.709/sRGB Primaries to BT.2100 Primaries
    // r3 = SrgbtoHlgScaler * r2   # Scale to HLG output signal range
    // g3 = SrgbtoHlgScaler * g2
    // b3 = SrgbtoHlgScaler * b2
    // (r4, g4, b4) = tf.hlg_inverse_eotf(r3, g3, b3, systemGamma)  # Convert to HLG Non-linear Signal (straightforward as systemGamma = 1.0)

}

// given HLG-encoded BT.2100 values, and also:
// Lw, the display monitor peak luminance
// Lb, the display monitor black luminance, and
// Lamb, the ambient luminance
// return the XYZ values for a display
function complete_REC2100HLGtoXYZ (sRGB, Lw=1000, Lb=0.05, Lamb=0.05, OOTF_gama=1.2 {

    // calculate black lift
    let beta = blackLevelLift()
})
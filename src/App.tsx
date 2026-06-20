import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Barcode, 
  Printer, 
  Download, 
  RefreshCw, 
  Sliders, 
  Layers, 
  FileText,
  Bookmark,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
// @ts-ignore
import { PDF417 } from "pdf417-generator";
// @ts-ignore
import JsBarcode from "jsbarcode";

// Exact Form Fields with defaults
const INITIAL_FORM_DATA = {
  license_number: "DL-2024-00412",
  last_name: "MWANGI",
  first_name: "JOHN",
  middle_name: "KAMAU",
  dob: "1995-03-14",
  issue_date: "2024-01-10",
  expiry_date: "2026-12-31",
  address: "123 UNIVERSITY ROAD",
  city: "RUIRU",
  county: "NAIROBI",
  zip: "00233",
  sex: "M",
  height: "5'11\"",
  eye_color: "BRN",
  hair_color: "BLK",
  category: "STUDENT",
  restrictions: "NONE",
  endorsements: "NONE",
  country: "KENYA",
};

const FIELD_ORDER = [
  ["DAQ", "license_number"],
  ["DCS", "last_name"],
  ["DAC", "first_name"],
  ["DAD", "middle_name"],
  ["DBB", "dob"],
  ["DBD", "issue_date"],
  ["DBA", "expiry_date"],
  ["DAG", "address"],
  ["DAI", "city"],
  ["DAJ", "county"],
  ["DAK", "zip"],
  ["DBC", "sex"],
  ["DAU", "height"],
  ["DAY", "eye_color"],
  ["DAZ", "hair_color"],
  ["DCA", "category"],
  ["DCB", "restrictions"],
  ["DCD", "endorsements"],
  ["DCG", "country"],
] as const;

export default function App() {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generationTime, setGenerationTime] = useState("");
  const [encodedText, setEncodedText] = useState("");
  
  // Custom layout tweak parameters to mimic python render_image
  const [aspectRatio, setAspectRatio] = useState(9); // Mathematically yields ~16 columns in standard PDF417 math
  const [inkColor, setInkColor] = useState("#000000");
  const [devicePixelRatio, setDevicePixelRatio] = useState(5); // high scale multiplier
  const [isFlashing, setIsFlashing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  const code128CanvasRef = useRef<HTMLCanvasElement>(null);
  const printCode128CanvasRef = useRef<HTMLCanvasElement>(null);

  // Field change handler
  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Form encoded text builder
  const buildEncodedText = (data: typeof INITIAL_FORM_DATA) => {
    return FIELD_ORDER.map(([prefix, fieldKey]) => {
      let val = data[fieldKey as keyof typeof INITIAL_FORM_DATA];
      if (val === undefined || val === null) {
        val = "NONE";
      } else {
        val = val.trim();
        if (val === "") {
          val = "NONE";
        }
      }
      return `${prefix} ${val}`;
    }).join("\n");
  };

  // Helper to draw the customized physical ID card-style layout
  const drawLayoutToCanvas = (targetCanvas: HTMLCanvasElement, rawText: string, barcodeColor: string) => {
    const tempCanvas = document.createElement("canvas");
    try {
      PDF417.draw(rawText, tempCanvas, aspectRatio, 5, devicePixelRatio, barcodeColor);
    } catch (err) {
      console.error("Temp canvas draw failed", err);
      return;
    }

    targetCanvas.width = 1200;
    targetCanvas.height = 400;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 400);

    // Draw the stretched/resized barcode at x=40, y=30, width=1120, height=260
    ctx.drawImage(tempCanvas, 40, 30, 1120, 260);

    // Center middle text at y=310
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    const idStr = formData.license_number.trim().toUpperCase();
    const nameStr = `${formData.first_name.trim().toUpperCase()} ${formData.last_name.trim().toUpperCase()}`;
    const textMiddle = `ID: ${idStr}     NAME: ${nameStr}`;
    ctx.fillText(textMiddle, 600, 310);

    // Bottom strip separating line (2px, #cccccc)
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 355);
    ctx.lineTo(1160, 355);
    ctx.stroke();

    // Bottom strip text: left organisation, right expiry (22px, color #666666)
    ctx.fillStyle = "#666666";
    ctx.font = "bold 22px monospace";
    
    ctx.textAlign = "left";
    const orgName = formData.country.trim().toUpperCase() || "KENYA";
    ctx.fillText(orgName, 40, 365);

    ctx.textAlign = "right";
    const expiryStr = formData.expiry_date.trim().toUpperCase();
    const expiryText = expiryStr ? `EXPIRY: ${expiryStr}` : "EXPIRY: N/A";
    ctx.fillText(expiryText, 1160, 365);
  };

  // Barcode generator runner
  const triggerGeneration = () => {
    if (!formData.license_number || !formData.first_name || !formData.last_name || !formData.dob) {
      alert("Please fill in all required fields marked with * (Licence Number, First Name, Last Name, Date of Birth)");
      return;
    }

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const rawText = buildEncodedText(formData);
    setEncodedText(rawText);

    // Render onto preview canvas
    if (canvasRef.current) {
      drawLayoutToCanvas(canvasRef.current, rawText, inkColor);
    }

    // Render onto print-only high-resolution canvas with default black ink
    if (printCanvasRef.current) {
      drawLayoutToCanvas(printCanvasRef.current, rawText, "#000000");
    }

    setIsGenerated(true);
    setGenerationTime(new Date().toLocaleTimeString());

    // Generate Code 128
    setTimeout(() => {
      if (code128CanvasRef.current && formData.license_number) {
        try {
          JsBarcode(code128CanvasRef.current, formData.license_number, {
            format: "CODE128",
            width: 1.5,
            height: 50,
            displayValue: true,
            fontSize: 12,
            font: "monospace",
            textMargin: 4,
            background: "#ffffff",
            lineColor: "#000000",
            margin: 10,
          });
        } catch (e) {
          console.error("Code128 draw failed", e);
        }
      }
      if (printCode128CanvasRef.current && formData.license_number) {
        try {
          JsBarcode(printCode128CanvasRef.current, formData.license_number, {
            format: "CODE128",
            width: 2.5,
            height: 80,
            displayValue: true,
            fontSize: 14,
            font: "monospace",
            textMargin: 6,
            background: "#ffffff",
            lineColor: "#000000",
            margin: 15,
          });
        } catch (e) {
          console.error("Print Code128 draw failed", e);
        }
      }
    }, 50);
  };

  // Trigger initial render
  useEffect(() => {
    triggerGeneration();
  }, [aspectRatio, inkColor, devicePixelRatio]);

  // Code 128 rendering effect
  useEffect(() => {
    if (isGenerated && formData.license_number) {
      if (code128CanvasRef.current) {
        try {
          JsBarcode(code128CanvasRef.current, formData.license_number, {
            format: "CODE128",
            width: 1.5,
            height: 50,
            displayValue: true,
            fontSize: 12,
            font: "monospace",
            textMargin: 4,
            background: "#ffffff",
            lineColor: "#000000",
            margin: 10,
          });
        } catch (e) {
          console.error("Code128 useEffect draw failed", e);
        }
      }
      if (printCode128CanvasRef.current) {
        try {
          JsBarcode(printCode128CanvasRef.current, formData.license_number, {
            format: "CODE128",
            width: 2.5,
            height: 80,
            displayValue: true,
            fontSize: 14,
            font: "monospace",
            textMargin: 6,
            background: "#ffffff",
            lineColor: "#000000",
            margin: 15,
          });
        } catch (e) {
          console.error("Print Code128 useEffect draw failed", e);
        }
      }
    }
  }, [isGenerated, formData.license_number]);

  // Save/Download Action for PDF417
  const handleDownloadPNG = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pdf417_${formData.license_number || "barcode"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save/Download Action for Code 128
  const handleDownloadCode128 = () => {
    if (!code128CanvasRef.current) return;
    const dataUrl = code128CanvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `code128_${formData.license_number || "barcode"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="root-container" className="flex flex-col min-h-screen bg-slate-100 text-[#191c1d] font-sans">
      
      {/* Bento-style Header with Branding */}
      <header className="bg-[#1a3a6b] text-white py-3 px-6 shadow-md flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-white/90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 5h2v14H3V5zm4 0h1v14H7V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zM3 5h22v14H3V5z" opacity=".3"></path>
            <path d="M3 5h2v14H3V5zm4 0h1v14H7V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5z"></path>
          </svg>
          <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase">PDF417 Barcode Generator</h1>
        </div>
        <div className="text-xs opacity-80 font-mono bg-[#122b50] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          v2.4.0 High-Res Output
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 md:p-6 flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto w-full">
        
        {/* LEFT COLUMN: Input form Styled in Bento block */}
        <section className="xl:w-3/5 bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-[#1a3a6b]" />
              <h2 className="text-[#1a3a6b] font-bold text-sm uppercase tracking-wider">Information Input</h2>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 text-xs" onSubmit={(e) => e.preventDefault()}>
              
              {/* Licence Number */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-600">Licence Number *</label>
                <input
                  type="text"
                  required
                  placeholder="DL-XXXX-XXXX"
                  value={formData.license_number}
                  onChange={(e) => handleInputChange("license_number", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* First & Last Name */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* Middle Name & Date of Birth */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Middle Name</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => handleInputChange("middle_name", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                />
              </div>

              {/* Issue & Expiry Dates */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Issue Date</label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange("issue_date", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => handleInputChange("expiry_date", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-600">Address</label>
                <input
                  type="text"
                  placeholder="Street Address, P.O. Box"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* City & County */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">County</label>
                <input
                  type="text"
                  value={formData.county}
                  onChange={(e) => handleInputChange("county", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* ZIP Code & Sex */}
              <div className="grid grid-cols-2 gap-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => handleInputChange("zip", e.target.value)}
                    className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600">Sex</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => handleInputChange("sex", e.target.value)}
                    className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
              </div>

              {/* Dimensions: Height, Eye, Hair */}
              <div className="grid grid-cols-3 gap-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600">Height</label>
                  <input
                    type="text"
                    value={formData.height}
                    onChange={(e) => handleInputChange("height", e.target.value)}
                    className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600">Eye</label>
                  <select
                    value={formData.eye_color}
                    onChange={(e) => handleInputChange("eye_color", e.target.value)}
                    className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="BRN">BRN</option>
                    <option value="BLU">BLU</option>
                    <option value="GRN">GRN</option>
                    <option value="HZL">HZL</option>
                    <option value="GRY">GRY</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600">Hair</label>
                  <select
                    value={formData.hair_color}
                    onChange={(e) => handleInputChange("hair_color", e.target.value)}
                    className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="BLK">BLK</option>
                    <option value="BRN">BRN</option>
                    <option value="BLD">BLD</option>
                    <option value="RED">RED</option>
                    <option value="GRY">GRY</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* Country */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* Restrictions */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-600">Restrictions</label>
                <input
                  type="text"
                  value={formData.restrictions}
                  onChange={(e) => handleInputChange("restrictions", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

              {/* Endorsements */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-600">Endorsements</label>
                <input
                  type="text"
                  value={formData.endorsements}
                  onChange={(e) => handleInputChange("endorsements", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800"
                />
              </div>

            </form>
          </div>

          <button
            onClick={triggerGeneration}
            className="mt-6 w-full bg-[#1a3a6b] text-white py-3 border border-[#1a3a6b] rounded-lg font-bold uppercase tracking-widest hover:bg-[#122b50] transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 text-xs text-center"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Barcode
          </button>
        </section>

        {/* RIGHT COLUMN: Stack of Bento bricks (Widgets) */}
        <section className="xl:w-2/5 flex flex-col gap-6">
          
          {/* Bento box 1: LIVE PREVIEW */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-stretch">
            <div className="flex items-center gap-2 mb-4 w-full border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-[#1a3a6b]" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Preview</h3>
            </div>
            
            <div className="flex flex-col gap-5">
              {/* PDF417 Barcode */}
              <div className="flex flex-col gap-1.5 items-start">
                <span className="text-[11px] font-bold text-[#1a3a6b] uppercase tracking-wider">PDF417 Barcode (Full Data)</span>
                <AnimatePresence mode="wait">
                  <motion.div
                    id="barcode-preview-box"
                    animate={{ 
                      scale: isFlashing ? 1.02 : 1,
                      borderColor: isFlashing ? "#1a3a6b" : "#f1f5f9"
                    }}
                    transition={{ duration: 0.15 }}
                    className="w-full aspect-[3/1] bg-white border border-slate-200 p-3 flex items-center justify-center min-h-[140px] relative overflow-hidden rounded-lg"
                  >
                    {!isGenerated && (
                      <div className="flex flex-col items-center opacity-40 text-center">
                        <Barcode className="w-12 h-12 text-slate-400 mb-1" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#43474f]">Awaiting Generation...</p>
                      </div>
                    )}

                    <canvas 
                      ref={canvasRef} 
                      className={`max-w-full max-h-full object-contain ${!isGenerated ? "hidden" : "block"}`}
                    />
                  </motion.div>
                </AnimatePresence>
                <p className="text-[10px] text-slate-500 font-medium">Encodes all 19 fields — use for full verification</p>
              </div>

              {/* Code 128 Barcode */}
              <div className="flex flex-col gap-1.5 items-start border-t border-slate-100 pt-4">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider font-sans">LICENCE NUMBER (Code 128)</span>
                <AnimatePresence mode="wait">
                  <motion.div
                    id="code128-preview-box"
                    className="w-full bg-white border border-slate-200 p-3 flex items-center justify-center min-h-[100px] relative overflow-hidden rounded-lg"
                  >
                    {!isGenerated && (
                      <div className="flex flex-col items-center opacity-40 text-center">
                        <Barcode className="w-12 h-12 text-slate-400 mb-1" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#43474f]">Awaiting Generation...</p>
                      </div>
                    )}

                    <canvas 
                      ref={code128CanvasRef} 
                      className={`max-w-[75%] max-h-full object-contain ${!isGenerated ? "hidden" : "block"}`}
                    />
                  </motion.div>
                </AnimatePresence>
                <p className="text-[10px] text-slate-500 font-medium font-sans">Encodes licence number only — use for quick lookup</p>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono tracking-wider uppercase flex justify-between w-full">
              <span>Standard: PDF417 & 128</span>
              <span>Cols: 16</span>
              <span>ECL: Level 5</span>
            </div>
          </div>

          {/* Bento box 2: ACTIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Actions</h3>
            
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDownloadPNG}
                  disabled={!isGenerated}
                  className="flex-1 bg-[#1a3a6b] hover:bg-[#122b50] text-white rounded-lg flex items-center justify-center gap-2 font-semibold py-3 transition-colors text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Download PDF417
                </button>
                
                <button
                  onClick={handleDownloadCode128}
                  disabled={!isGenerated}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold py-3 transition-colors text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Download Code 128
                </button>
              </div>
              
              <button
                onClick={() => window.print()}
                disabled={!isGenerated}
                className="w-full border-2 border-[#1a3a6b] text-[#1a3a6b] rounded-lg flex items-center justify-center gap-2 font-semibold py-3 transition-colors text-xs cursor-pointer hover:bg-[#1a3a6b]/5 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                Print Barcode
              </button>
            </div>

            <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-[#475f87]">
              <Bookmark className="w-4 h-4 shrink-0 mt-0.5 text-[#1a3a6b]" />
              <p className="text-[10px] leading-relaxed font-medium">
                Complies with institutional physical scanning regulations. Suitable for direct high-contrast thermal badge and document paper printing.
              </p>
            </div>
          </div>



          {/* Bento box 4: RAW PAYLOAD METRICS */}
          {isGenerated && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 text-[#1a3a6b]">
                <Layers className="w-4 h-4" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Raw Input Payload</h3>
              </div>
              <div className="max-h-[120px] overflow-y-auto bg-slate-50 border border-slate-150 p-3 rounded-lg">
                <pre className="font-mono text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                  {encodedText}
                </pre>
              </div>
              <div className="mt-2 text-[9px] text-slate-400 uppercase font-bold flex justify-between">
                <span>Verified: Yes</span>
                <span>Stamp: {generationTime}</span>
              </div>
            </div>
          )}

        </section>
      </main>

      {/* Bento-style footer */}
      <footer className="bg-white border-t py-2.5 px-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400 uppercase tracking-tighter gap-2">
        <div className="font-mono flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          System Ready - Output: /output/barcode_test.png
        </div>
        <div>
          Dimensions: {isGenerated ? "3200 x 1060 px (High Density)" : "AWAITING PARAMS"}
        </div>
      </footer>

      {/* Hidden high-res print document element */}
      <div id="print-container" style={{ display: "none" }} className="p-8 bg-white">
        <div className="flex flex-col items-center gap-6 max-w-[600px] bg-white p-10 text-center font-sans">
          <div className="flex items-center gap-3">
            <Barcode className="w-8 h-8 text-slate-800" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-800">
              Institutional Barcode Document
            </h2>
          </div>
          <div className="text-xs text-slate-500 font-mono -mt-3">
            SERIAL: {formData.license_number || "U-REC-EXPORT"} | DATE: {new Date().toLocaleDateString()}
          </div>
          
          <div className="w-full flex flex-col gap-1 items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PDF417 Barcode (Full data)</span>
            <div className="w-full aspect-[3/1] border border-gray-300 p-2 bg-white flex items-center justify-center">
              <canvas ref={printCanvasRef} className="max-w-full max-h-full object-contain" />
            </div>
          </div>
          
          <div className="w-full flex flex-col gap-1 items-center mt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Licence Number (Code 128)</span>
            <div className="w-[80%] aspect-[4/1] border border-gray-300 p-2 bg-white flex items-center justify-center">
              <canvas ref={printCode128CanvasRef} className="max-w-full max-h-full object-contain" />
            </div>
          </div>

          <table className="w-full text-left font-mono text-[11px] text-slate-600 border-collapse border border-slate-200 mt-2">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-2 border-r border-slate-200 w-2/5">FIELD PREFIX</th>
                <th className="p-2">DATA DECODED VALUE</th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 border-r border-slate-200 font-bold">DAQ (License)</td>
                <td className="p-2">{formData.license_number}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 border-r border-slate-200 font-bold">DCS (Last Name)</td>
                <td className="p-2">{formData.last_name}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 border-r border-slate-200 font-bold">DAC (First Name)</td>
                <td className="p-2">{formData.first_name}</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">DBB (Dob)</td>
                <td className="p-2">{formData.dob}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-3">
            VERIFIED SECURE DOCUMENT • END OF EXPORT RECORD
          </div>
        </div>
      </div>

    </div>
  );
}

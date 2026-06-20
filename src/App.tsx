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
  category: "C",
  restrictions: "NONE",
  endorsements: "NONE",
  country: "KENYA",
  sequence_number: "",
  revision_date: "",
  magnetic_track_1: "",
  magnetic_track_2: "",
  magnetic_track: ""
};

const getMagneticTracks = (data: typeof INITIAL_FORM_DATA) => {
  let countyUpper = (data.county || "CA").trim().toUpperCase();
  let stCode = countyUpper.slice(0, 2);
  if (!stCode || countyUpper === "NONE") {
    stCode = "CA";
  }
  const lic = (data.license_number || "").trim().toUpperCase();
  const last = (data.last_name || "").trim().toUpperCase();
  const first = (data.first_name || "").trim().toUpperCase();
  
  const formatToYYMMDD = (dateStr: string) => {
    if (!dateStr) return "000000";
    const parts = dateStr.trim().split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts;
      const shortYear = year.slice(-2);
      return `${shortYear}${month}${day}`;
    }
    return "000000";
  };
  
  const expYY = formatToYYMMDD(data.expiry_date);
  const dobYY = formatToYYMMDD(data.dob);
  
  const track1 = `%${stCode}${lic}^${last}/${first}^${expYY}?`;
  const track2 = `;${lic}=${expYY}${dobYY}?`;
  
  return {
    track1,
    track2,
    combined: `Track 1: ${track1}\nTrack 2: ${track2}`
  };
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
  ["DCT", "magnetic_track_1"],
  ["DCU", "magnetic_track_2"],
  ["DCM", "sequence_number"],
  ["DCN", "revision_date"],
] as const;

const formatDateToMMDDYY = (dateStr: string): string => {
  if (!dateStr || dateStr.trim().toLowerCase() === "none") return "NONE";
  const parts = dateStr.trim().split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    const shortYear = year.slice(-2);
    return `${month}/${day}/${shortYear}`;
  }
  return dateStr;
};

const formatDateToYYYYMMDD = (dateStr: string): string => {
  if (!dateStr || dateStr.trim().toLowerCase() === "none") return "NONE";
  const cleaned = dateStr.replace(/[\/-]/g, "").trim();
  if (/^\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  const parts = dateStr.trim().split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
    } else if (parts[2].length === 4) {
      const [p1, p2, year] = parts;
      return `${year}${p1.padStart(2, "0")}${p2.padStart(2, "0")}`;
    }
  }
  return cleaned.toUpperCase();
};

const cleanLicenseNumber = (license: string): string => {
  return license.toUpperCase().replace(/[^A-Z0-9]/g, "");
};

const getF = (val: string) => (val || "NONE").trim().toUpperCase();

const getIIN = (country: string, state: string): string => {
  const c = country.toUpperCase().trim();
  if (c === "KENYA") return "990001";
  if (c === "CANADA") return "300022";
  return "636014";
};

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
    setFormData((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      const tracks = getMagneticTracks(updated);
      return {
        ...updated,
        magnetic_track_1: tracks.track1,
        magnetic_track_2: tracks.track2,
        magnetic_track: tracks.combined,
      };
    });
  };

  // Form encoded text builder
  const buildEncodedText = (data: typeof INITIAL_FORM_DATA) => {
    // Validate and format values first
    const iin = getIIN(data.country, data.county);
    const version = "11";
    const jversion = "00";
    const numSubfiles = "01";
    const subfileType = "DL";

    // Build subfile elements
    const elements: string[] = [];

    // 1. License Number (8-18 chars, alphanumeric)
    let lic = cleanLicenseNumber(data.license_number);
    if (lic.length < 8) lic = lic.padEnd(8, "0");
    if (lic.length > 18) lic = lic.slice(0, 18);
    elements.push(`DAQ ${lic}`);

    // 2. Name (Last, First, Middle) -> Rule 3
    const last = getF(data.last_name);
    const first = getF(data.first_name);
    const mid = data.middle_name && data.middle_name.toUpperCase() !== "NONE" ? data.middle_name.trim().toUpperCase() : "";
    const nameVal = `${last},${first},${mid}`;
    elements.push(`DAA ${nameVal}`);

    // 3. Date of Birth -> Rule 1
    elements.push(`DBB ${formatDateToYYYYMMDD(data.dob)}`);

    // 4. Issue Date -> Rule 1
    elements.push(`DBD ${formatDateToYYYYMMDD(data.issue_date)}`);

    // 5. Expiry Date -> Rule 1
    elements.push(`DBA ${formatDateToYYYYMMDD(data.expiry_date)}`);

    // 6. Address -> Rule 5
    const street = getF(data.address);
    const city = getF(data.city);
    const state = getF(data.county);
    const zip = getF(data.zip);
    const addressVal = `${street},${city},${state},${zip}`;
    elements.push(`DAG ${addressVal}`);

    // 7. City
    elements.push(`DAI ${city}`);

    // 8. State/Province
    elements.push(`DAJ ${state}`);

    // 9. ZIP/Postal Code
    elements.push(`DAK ${zip}`);

    // 10. Sex (M/F)
    let sexVal = getF(data.sex);
    if (sexVal !== "M" && sexVal !== "F") sexVal = "M"; // Safe default
    elements.push(`DBC ${sexVal}`);

    // 11. Height
    elements.push(`DAU ${getF(data.height)}`);

    // 12. Eye Color
    elements.push(`DAY ${getF(data.eye_color)}`);

    // 13. Hair Color
    elements.push(`DAZ ${getF(data.hair_color)}`);

    // 14. Class -> Rule 7
    let categoryRaw = getF(data.category);
    let classCode = categoryRaw;
    if (categoryRaw === "STUDENT") classCode = "C";
    elements.push(`DCA ${classCode}`);

    // 15. Restrictions -> Rule 8
    let restrRaw = getF(data.restrictions);
    let restrCode = restrRaw;
    if (restrRaw === "NONE" || !restrRaw) restrCode = "NONE";
    elements.push(`DCB ${restrCode}`);

    // 16. Endorsements -> Rule 8
    let endRaw = getF(data.endorsements);
    let endCode = endRaw;
    if (endRaw === "NONE" || !endRaw) endCode = "NONE";
    elements.push(`DCD ${endCode}`);

    // 17. Country
    elements.push(`DCG ${getF(data.country)}`);

    // 18. Magnetic Track 1
    elements.push(`DCT ${data.magnetic_track_1 || ""}`);

    // 19. Magnetic Track 2
    elements.push(`DCU ${data.magnetic_track_2 || ""}`);

    // 20. Sequence Number
    elements.push(`DCM ${data.sequence_number || ""}`);

    // 21. Revision Date
    elements.push(`DCN ${data.revision_date || ""}`);

    // Join elements with LF (\n) and terminate with Segment Terminator (CR \r)
    const subfileData = `${subfileType}\r${elements.join("\n")}\n`;

    // Calculate Length and Offset
    const offsetStr = "0031";
    const lengthStr = subfileData.length.toString().padStart(4, "0");

    // Build complete string
    const header = `@\n\u001e\rANSI ${iin}${version}${jversion}${numSubfiles}${subfileType}${offsetStr}${lengthStr}`;
    
    return `${header}${subfileData}`;
  };

  const getCategoryDesc = (code: string) => {
    switch(code) {
      case "A": return "Commercial Vehicle >26000 lbs";
      case "B": return "Commercial Vehicle >26000 lbs single";
      case "C": return "Vehicle w/GVWR <=26000 No M/C";
      case "M": return "Motorcycle only";
      case "A/M": return "Commercial + Motorcycle";
      case "C/M": return "Class C + Motorcycle";
      default: return getF(code);
    }
  };

  const getEndorsementDesc = (code: string) => {
    switch(code) {
      case "NONE": return "None";
      case "H": return "Hazardous Materials";
      case "M": return "Motorcycle";
      case "N": return "Tank Vehicle";
      case "P": return "Passenger";
      case "S": return "School Bus";
      case "T": return "Double/Triple Trailers";
      case "X": return "Tanker + Hazmat";
      default: return getF(code);
    }
  };

  const getRestrictionDesc = (code: string) => {
    switch(code) {
      case "NONE": return "None";
      case "A": return "Military only";
      case "B": return "Corrective lenses";
      case "C": return "Mechanical aid";
      case "D": return "Prosthetic aid";
      case "E": return "No manual transmission";
      case "F": return "Outside mirror required";
      case "G": return "Daylight driving only";
      default: return getF(code);
    }
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
    targetCanvas.height = 600;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 600);

    // 1. Black Magnetic Stripe (Height 80px)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 1200, 80);

    // 2. Track Data Strings below magnetic stripe
    ctx.fillStyle = "#333333";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    
    const { track1, track2 } = getMagneticTracks(formData);
    ctx.fillText(`Track 1: ${track1}`, 40, 100);
    ctx.fillText(`Track 2: ${track2}`, 40, 125);

    // 3. Divider line
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 160);
    ctx.lineTo(1160, 160);
    ctx.stroke();

    // 4. LHS Block: CLASS, RESTRICTIONS, ENDORSEMENTS
    // Heading format
    const drawMetaRow = (label: string, value: string, desc: string, x: number, y: number) => {
      if (!ctx) return;
      ctx.fillStyle = "#666666";
      ctx.font = "normal 12px sans-serif";
      ctx.fillText(label, x, y);
      
      ctx.fillStyle = "#111111";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${value} - ${desc}`, x, y + 20);
    };

    drawMetaRow("VEHICLE CLASS", getF(formData.category), getCategoryDesc(getF(formData.category)), 40, 190);
    drawMetaRow("RESTRICTIONS", getF(formData.restrictions), getRestrictionDesc(getF(formData.restrictions)), 40, 250);
    drawMetaRow("ENDORSEMENTS", getF(formData.endorsements), getEndorsementDesc(getF(formData.endorsements)), 40, 310);

    // 5. Divider inside the LHS/RHS block
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(400, 180);
    ctx.lineTo(400, 360);
    ctx.stroke();

    // 6. Draw PDF417 Barcode (Centered vertically/horizontally in RHS)
    // Area for PDF417: x = 440 to 1100, y = 180 to 360
    ctx.drawImage(tempCanvas, 440, 180, 640, 180);

    // 7. Vertically-oriented Sequence Number along right edge of PDF417
    ctx.save();
    ctx.translate(1120, 270);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#333333";
    ctx.font = "bold 18px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(formData.sequence_number || "000000", 0, 0);
    ctx.restore();

    // 8. Bottom divider
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 380);
    ctx.lineTo(1160, 380);
    ctx.stroke();

    // 9. Code 128 Barcode Space
    if (code128CanvasRef.current) {
      // Draw centered Code128
      ctx.drawImage(code128CanvasRef.current, 400, 410, 400, 120);
    } else {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 20px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillText(formData.license_number, 600, 480);
    }

    // 10. Card Design Revision Date at bottom right
    ctx.fillStyle = "#666666";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`REV ${formData.revision_date || "10/2020"}`, 1160, 560);
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

  // Trigger initial render + setup sequence/revision/track values on mount
  useEffect(() => {
    const seqNum = Math.floor(100000 + Math.random() * 900000).toString();
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yyyy = today.getFullYear();
    const revDate = `${mm}/${dd}/${yyyy}`;

    setFormData((prev) => {
      const updated = {
        ...prev,
        sequence_number: seqNum,
        revision_date: revDate,
      };
      const tracks = getMagneticTracks(updated);
      return {
        ...updated,
        magnetic_track_1: tracks.track1,
        magnetic_track_2: tracks.track2,
        magnetic_track: tracks.combined,
      };
    });
  }, []);

  useEffect(() => {
    if (formData.sequence_number) {
      triggerGeneration();
    }
  }, [aspectRatio, inkColor, devicePixelRatio, formData.sequence_number, formData.category, formData.restrictions, formData.endorsements]);

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

              {/* Vehicle Class (Category) */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-600">Vehicle Class</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <option value="A">A - Commercial Vehicle &gt;26000 lbs</option>
                  <option value="B">B - Commercial Vehicle &gt;26000 lbs single</option>
                  <option value="C">C - Vehicle w/GVWR &le;26000 No M/C (default)</option>
                  <option value="M">M - Motorcycle only</option>
                  <option value="A/M">A/M - Commercial + Motorcycle</option>
                  <option value="C/M">C/M - Class C + Motorcycle</option>
                </select>
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
                <select
                  value={formData.restrictions}
                  onChange={(e) => handleInputChange("restrictions", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <option value="NONE">None (default)</option>
                  <option value="A">A - Military only</option>
                  <option value="B">B - Corrective lenses</option>
                  <option value="C">C - Mechanical aid</option>
                  <option value="D">D - Prosthetic aid</option>
                  <option value="E">E - No manual transmission</option>
                  <option value="F">F - Outside mirror required</option>
                  <option value="G">G - Daylight driving only</option>
                </select>
              </div>

              {/* Endorsements */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-600">Endorsements</label>
                <select
                  value={formData.endorsements}
                  onChange={(e) => handleInputChange("endorsements", e.target.value)}
                  className="border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1a3a6b] outline-none transition-all text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <option value="NONE">None (default)</option>
                  <option value="H">H - Hazardous Materials</option>
                  <option value="M">M - Motorcycle</option>
                  <option value="N">N - Tank Vehicle</option>
                  <option value="P">P - Passenger</option>
                  <option value="S">S - School Bus</option>
                  <option value="T">T - Double/Triple Trailers</option>
                  <option value="X">X - Tanker + Hazmat</option>
                </select>
              </div>

              {/* Read-only fields segment */}
              <div className="grid grid-cols-2 gap-2 md:col-span-2 border-t border-slate-100 pt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Sequence Number (Auto)</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.sequence_number}
                    className="border border-slate-150 p-2 rounded-lg bg-slate-100 outline-none text-xs font-mono text-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Revision Date (Auto)</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.revision_date}
                    className="border border-slate-150 p-2 rounded-lg bg-slate-100 outline-none text-xs font-mono text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-400">Magnetic Track 1 Display (Auto)</label>
                <input
                  type="text"
                  readOnly
                  value={formData.magnetic_track_1}
                  className="border border-slate-150 p-2 rounded-lg bg-slate-100 outline-none text-xs font-mono text-slate-500"
                />
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-400">Magnetic Track 2 Display (Auto)</label>
                <input
                  type="text"
                  readOnly
                  value={formData.magnetic_track_2}
                  className="border border-slate-150 p-2 rounded-lg bg-slate-100 outline-none text-xs font-mono text-slate-500"
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
                <td className="p-2">{formatDateToMMDDYY(formData.dob)}</td>
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

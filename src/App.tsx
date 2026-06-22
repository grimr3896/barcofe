import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Barcode, 
  Printer, 
  Download, 
  RefreshCw, 
  FileText,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

// @ts-ignore
import { PDF417 as PDF417_Named } from "pdf417-generator";
// @ts-ignore
import PDF417_Default from "pdf417-generator";
// @ts-ignore
import JsBarcode from "jsbarcode";

const PDF417 = PDF417_Named || (PDF417_Default && typeof PDF417_Default === 'object' && ((PDF417_Default as any).PDF417 || PDF417_Default)) || (window as any).PDF417;

// US States Array (All 50 US States)
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
];

// Initial form data aligning with the user's expected scan output
const INITIAL_FORM_DATA = {
  license_number: "T16700285",
  last_name: "SILVER",
  first_name: "ALEX",
  middle_name: "JAMES",
  dob: "1998-07-15",
  issue_date: "2017-08-14",
  expiry_date: "2028-08-14",
  address: "3001 S CHESTER AVE APT 2",
  city: "BAKERSFIELD",
  state_code: "CA",
  zip: "93304",
  sex: "M",
  height_feet: "5",
  height_inches: "11",
  weight: "160",
  iin: "636055",
  eye_color: "BRN",
  hair_color: "BLK",
  vehicle_class: "C",
  restrictions: "NONE",
  endorsements: "NONE",
  country: "USA",
  document_discriminator: "1827364590",
};

function formatDateAAMVA(dateStr: string): string {
  if (!dateStr || dateStr === 'NONE') return 'NONE';
  const clean = dateStr.replace(/-/g, '').replace(/\//g, '');
  if (clean.length === 8) {
    if (clean.startsWith('19') || clean.startsWith('20')) {
      const year = clean.slice(0, 4);
      const month = clean.slice(4, 6);
      const day = clean.slice(6, 8);
      return month + day + year;
    }
    return clean;
  }
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return month + day + year;
  }
  return dateStr;
}

function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr || dateStr === 'NONE') return 'NONE';
  const clean = dateStr.replace(/-/g, '').replace(/\//g, '');
  if (clean.length === 8) {
    if (clean.startsWith('19') || clean.startsWith('20')) {
      const year = clean.slice(0, 4);
      const month = clean.slice(4, 6);
      const day = clean.slice(6, 8);
      return `${month}/${day}/${year}`;
    }
    const month = clean.slice(0, 2);
    const day = clean.slice(2, 4);
    const year = clean.slice(4, 8);
    return `${month}/${day}/${year}`;
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${month}/${day}/${year}`;
    }
  }
  return dateStr;
}

function getRevDate() {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `Rev ${mm}/${dd}/${yyyy}`;
}

function formatHeightDisplay(aamvaHeight: string): string {
  // Convert 071 IN back to 5'11"
  const match = aamvaHeight.match(/(\d+)/);
  if (match) {
    const totalInches = parseInt(match[1]);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${String(inches).padStart(2,'0')}"`;
  }
  return aamvaHeight;
}

function formatSexDisplay(sexNumeric: string): string {
  return sexNumeric === '1' ? 'M' : 'F';
}

function formatIssueDateDisplay(aamvaDate: string): string {
  // Convert MMDDYYYY to MM/DD/YYYY
  if (aamvaDate && aamvaDate.length === 8) {
    const mm = aamvaDate.slice(0, 2);
    const dd = aamvaDate.slice(2, 4);
    const yyyy = aamvaDate.slice(4, 8);
    return `${mm}/${dd}/${yyyy}`;
  }
  return aamvaDate;
}

function getAuditNumber(): string {
  return String(new Date().getFullYear()).slice(-2);
}

function generateTrack1(stateCode: string, licNum: string, lastName: string, firstName: string, expiryAAMVA: string): string {
  const expMM = expiryAAMVA.slice(0, 2);
  const expYY = expiryAAMVA.slice(6, 8);
  const yymm = expYY + expMM;
  const last = (lastName || '').toUpperCase();
  const first = (firstName || '').toUpperCase();
  return `%${stateCode}${licNum}^${last}/${first}^${yymm}?`;
}

function generateTrack2(licNum: string, expiryAAMVA: string, dobAAMVA: string): string {
  const expMM = expiryAAMVA.slice(0, 2);
  const expYY = expiryAAMVA.slice(6, 8);
  const yymm = expYY + expMM;

  const dobYY = dobAAMVA.slice(6, 8);
  const dobMM = dobAAMVA.slice(0, 2);
  const dobDD = dobAAMVA.slice(2, 4);
  const yymmdd = dobYY + dobMM + dobDD;

  return `;${licNum}=${yymm}${yymmdd}?`;
}

function generateTrackStrings(person: any) {
  const stateCode = (person.state_code || 'CA').toUpperCase();
  const licNum = person.license_number || '';
  const lastName = (person.last_name || '').toUpperCase();
  const firstName = (person.first_name || '').toUpperCase();

  const expiryAAMVA = formatDateAAMVA(person.expiry_date || '');
  const dobAAMVA = formatDateAAMVA(person.dob || '');

  const track1 = generateTrack1(stateCode, licNum, lastName, firstName, expiryAAMVA);
  const track2 = generateTrack2(licNum, expiryAAMVA, dobAAMVA);

  return { track1, track2 };
}

function convertHeight(feet: string | number, inches: string | number) {
  const ft = parseInt(String(feet)) || 0;
  const ins = parseInt(String(inches)) || 0;
  const totalInches = (ft * 12) + ins;
  const aamva = String(totalInches).padStart(3, '0') + ' IN';
  const display = `${ft}'${String(ins).padStart(2,'0')}"`;
  return { aamva, display };
}

function encodeSex(sexValue: string): string {
  const s = (sexValue || '').toUpperCase();
  if (s === 'M' || s === 'MALE') return '1';
  if (s === 'F' || s === 'FEMALE') return '2';
  return '9';
}

function generateDocumentDiscriminator(): string {
  return String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

function buildAAMVAString(person: any, signatureHash?: string) {
  const iin = person.iin || '636055';
  const header = `@\n\x1e\rANSI ${iin}0101DL00310322DL\n`;
  
  const sex = encodeSex(person.sex);
  
  const dcf = person.document_discriminator || generateDocumentDiscriminator();
  
  // Strip address to street only
  let address = (person.address || '').toUpperCase();
  if (address.includes(',')) {
    address = address.split(',')[0].trim();
  }

  const { aamva: heightAAMVA } = convertHeight(person.height_feet || "5", person.height_inches || "11");

  const fields = [
    ['DAQ', person.license_number],
    ['DCS', (person.last_name || '').toUpperCase()],
    ['DAC', (person.first_name || '').toUpperCase()],
    ['DAD', (person.middle_name || 'NONE').toUpperCase()],
    ['DBB', formatDateAAMVA(person.dob)],
    ['DBA', formatDateAAMVA(person.expiry_date)],
    ['DBC', sex],
    ['DAY', person.eye_color || 'BRN'],
    ['DAU', heightAAMVA],
    ['DAG', address],
    ['DAI', (person.city || '').toUpperCase()],
    ['DAJ', (person.state_code || 'CA').toUpperCase()],
    ['DAK', person.zip || '00000'],
    ['DCF', dcf],
    ['DCG', 'USA'],
    ['DCA', person.vehicle_class || 'C'],
    ['DCB', person.restrictions || 'NONE'],
    ['DCD', person.endorsements || 'NONE'],
    ['DBD', formatDateAAMVA(person.issue_date)],
    ['DAZ', person.hair_color || 'BLK'],
    ['DAW', person.weight || '160'],
    ['DDA', 'F'],
  ];

  if (signatureHash) {
    fields.push(['DCK', signatureHash]);
  }

  const body = fields
    .map(([code, value]) => `${code} ${value || 'NONE'}`)
    .join('\n');

  return {
    encodedString: header + body,
    fields,
    dcf
  };
}

export default function App() {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generationTime, setGenerationTime] = useState("");
  const [encodedText, setEncodedText] = useState("");
  const [encodedFields, setEncodedFields] = useState<[string, string][]>([]);
  const [isFlashing, setIsFlashing] = useState(false);

  // Feature 1 — Signature States
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState<string>("");

  // Signature change handler
  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSignatureData(reader.result as string);
        setSignatureName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Field change handler
  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Standard trigger generation runner
  const triggerGeneration = () => {
    if (!formData.license_number || !formData.first_name || !formData.last_name || !formData.dob) {
      alert("Please fill in Licence Number, First Name, Last Name, and Date of Birth.");
      return;
    }

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const person = {
      ...formData,
      height: `${formData.height_feet}'${formData.height_inches}`
    };

    // Use current or generate fresh discriminator
    let dcf_val = formData.document_discriminator;
    if (!dcf_val) {
      dcf_val = generateDocumentDiscriminator();
      setFormData(prev => ({ ...prev, document_discriminator: dcf_val }));
      person.document_discriminator = dcf_val;
    }

    const signature_filename_or_hash = signatureName ? signatureName : "SIG_DEFAULT";
    const { encodedString, fields } = buildAAMVAString(person, signature_filename_or_hash);
    setEncodedText(encodedString);
    setEncodedFields(fields as [string, string][]);

    // Draw barcodes client-side with native bundles
    setTimeout(() => {
      // PDF417
      const canvas = document.getElementById('pdf417Canvas') as HTMLCanvasElement;
      if (canvas && PDF417 && typeof PDF417.draw === 'function') {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        try {
          // 2. Generate PDF417 — PDF417.draw(aamvaString, canvas, 3, 5)
          PDF417.draw(encodedString, canvas, 3, 5);
          
          // 3. Show canvas — document.getElementById('pdf417Canvas').style.display = 'block'
          canvas.style.display = 'block';
          
          // 4. Hide any placeholder text
          const placeholder = document.getElementById('pdf417Placeholder');
          if (placeholder) {
            placeholder.style.display = 'none';
          }
        } catch (err) {
          console.error("PDF417 Draw Error", err);
        }
      }

      // Code 128
      const c128Canvas = document.getElementById('code128Canvas') as HTMLCanvasElement;
      if (c128Canvas && JsBarcode) {
        try {
          JsBarcode('#code128Canvas', person.license_number, {
            format: 'CODE128',
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            background: "#ffffff",
            lineColor: "#000000"
          });
        } catch (err) {
          console.error("Code128 Draw Error", err);
        }
      }
    }, 60);

    setIsGenerated(true);
    setGenerationTime(new Date().toLocaleTimeString());
  };

  // Generate automatically on initial load
  useEffect(() => {
    triggerGeneration();
  }, []);

  // Sync barcode regeneration upon signature load/update
  useEffect(() => {
    if (isGenerated) {
      triggerGeneration();
    }
  }, [signatureData, signatureName]);

  const handleDownloadPDF417 = () => {
    const canvas = document.getElementById('pdf417Canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pdf417.png';
        a.click();
      });
    } catch (e) {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'pdf417.png';
      a.click();
    }
  };

  const handleDownloadCode128 = () => {
    const canvas = document.getElementById('code128Canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'code128.png';
        a.click();
      });
    } catch (e) {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'code128.png';
      a.click();
    }
  };

  return (
    <div id="root-container" className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      
      {/* Bento-style Header with Branding */}
      <header className="bg-slate-900 text-white py-3.5 px-6 shadow-sm flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 5h2v14H3V5zm4 0h1v14H7V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zM3 5h22v14H3V5z" opacity=".2"></path>
            <path d="M3 5h2v14H3V5zm4 0h1v14H7V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5z"></path>
          </svg>
          <h1 className="text-base md:text-lg font-extrabold tracking-wider uppercase">PDF417 & 128 Utility</h1>
        </div>
        <div className="text-[10px] uppercase font-mono bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-900/50 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Pure Client-Side Encoder
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 md:p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        
        {/* LEFT COLUMN: Input form Styled in Bento block */}
        <section className="lg:w-[58%] bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h2 className="text-slate-800 font-bold text-xs uppercase tracking-widest">Metadata Values</h2>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3" onSubmit={(e) => e.preventDefault()}>
              
              {/* Issuer ID Number */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Issuer ID Number (IIN) *</label>
                <input
                  type="text"
                  required
                  placeholder="636055"
                  value={formData.iin}
                  onChange={(e) => handleInputChange("iin", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              {/* Licence Number */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Licence Number *</label>
                <input
                  type="text"
                  required
                  placeholder="DL-XXXX-XXXX"
                  value={formData.license_number}
                  onChange={(e) => handleInputChange("license_number", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              {/* First & Last Name */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              {/* Middle Name & Date of Birth */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Middle Name</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => handleInputChange("middle_name", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                />
              </div>

              {/* Issue & Expiry Dates */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Issue Date</label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange("issue_date", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => handleInputChange("expiry_date", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Address (Street only is extracted)</label>
                <input
                  type="text"
                  placeholder="Street Address, P.O. Box"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              {/* City & US State Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">US State Code *</label>
                <select
                  value={formData.state_code}
                  onChange={(e) => handleInputChange("state_code", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                >
                  {US_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* ZIP Code & Sex Dropdown */}
              <div className="grid grid-cols-2 gap-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => handleInputChange("zip", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Sex</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => handleInputChange("sex", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>
              </div>

              {/* Dimensions: Weight, Eye, Hair */}
              <div className="grid grid-cols-3 gap-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Weight (lbs)</label>
                  <input
                    type="text"
                    placeholder="160"
                    value={formData.weight}
                    onChange={(e) => handleInputChange("weight", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Eye</label>
                  <select
                    value={formData.eye_color}
                    onChange={(e) => handleInputChange("eye_color", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                  >
                    <option value="BRN">BRN</option>
                    <option value="BLU">BLU</option>
                    <option value="GRN">GRN</option>
                    <option value="HZL">HZL</option>
                    <option value="GRY">GRY</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Hair</label>
                  <select
                    value={formData.hair_color}
                    onChange={(e) => handleInputChange("hair_color", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                  >
                    <option value="BLK">BLK</option>
                    <option value="BRN">BRN</option>
                    <option value="BLD">BLD</option>
                    <option value="RED">RED</option>
                    <option value="GRY">GRY</option>
                  </select>
                </div>
              </div>

              {/* Height dropdowns */}
              <div className="grid grid-cols-2 gap-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Height (Feet)</label>
                  <select
                    value={formData.height_feet}
                    onChange={(e) => handleInputChange("height_feet", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                  >
                    <option value="4">4 ft</option>
                    <option value="5">5 ft</option>
                    <option value="6">6 ft</option>
                    <option value="7">7 ft</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Height (Inches)</label>
                  <select
                    value={formData.height_inches}
                    onChange={(e) => handleInputChange("height_inches", e.target.value)}
                    className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(inch => (
                      <option key={inch} value={inch}>{inch} in</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vehicle Class (Category) */}
              <div className="flex flex-col gap-1 md:col-span-1">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Vehicle Class</label>
                <select
                  value={formData.vehicle_class}
                  onChange={(e) => handleInputChange("vehicle_class", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
                >
                  <option value="A">A - Commercial Vehicle (Class A)</option>
                  <option value="B">B - Commercial Vehicle (Class B)</option>
                  <option value="C">C - Standard Passenger (Class C)</option>
                  <option value="M">M - Motorcycle Flag (Class M)</option>
                </select>
              </div>

              {/* Restrictions */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Restrictions</label>
                <select
                  value={formData.restrictions}
                  onChange={(e) => handleInputChange("restrictions", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
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
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Endorsements</label>
                <select
                  value={formData.endorsements}
                  onChange={(e) => handleInputChange("endorsements", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all text-xs font-medium text-slate-850 cursor-pointer"
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

              {/* Document Discriminator */}
              <div className="flex flex-col gap-1 md:col-span-2 border-t border-slate-100 pt-3">
                <label className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Document Discriminator (DCF 10-Digit Auto / Manual)</label>
                <input
                  type="text"
                  placeholder="Randomized 10-digit discriminator code"
                  value={formData.document_discriminator}
                  onChange={(e) => handleInputChange("document_discriminator", e.target.value)}
                  className="border border-slate-200/80 p-2 rounded-lg bg-slate-100 outline-none text-xs font-mono text-slate-600 focus:bg-white"
                />
              </div>

              {/* Signature Upload (Feature 1) */}
              <div className="flex flex-col gap-1 md:col-span-2 border-t border-slate-100 pt-3">
                <label className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider" htmlFor="signatureUpload">Upload Signature Image</label>
                <input
                  type="file"
                  id="signatureUpload"
                  accept="image/*"
                  name="signature"
                  onChange={handleSignatureChange}
                  className="border border-slate-250 p-2 rounded-lg bg-slate-50 text-xs font-mono text-slate-600 outline-none file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border file:border-indigo-200 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

            </form>
          </div>

          <button
            onClick={triggerGeneration}
            className="mt-6 w-full bg-indigo-600 text-white py-3 border border-indigo-600 rounded-lg font-bold uppercase tracking-widest hover:bg-indigo-750 transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 text-xs text-center"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
            Generate Barcode
          </button>
        </section>

        {/* RIGHT COLUMN: Live Previews + Decoded fields panel */}
        <section className="lg:w-[42%] flex flex-col gap-6">
          
          {/* Bento box 1: LIVE PREVIEW OF CANVASES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col items-stretch">
            <div className="flex items-center gap-2 mb-4 w-full border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Card Back Layout Preview</h3>
            </div>
            
            {/* Real CR80 Physical Card layout mockup */}
            <AnimatePresence mode="wait">
              <motion.div
                id="barcode-preview-box"
                animate={{ 
                  scale: isFlashing ? 1.01 : 1,
                  borderColor: isFlashing ? "rgb(79, 70, 229)" : "rgb(226, 232, 240)"
                }}
                transition={{ duration: 0.15 }}
                className="relative w-full border border-slate-300 rounded-xl bg-white overflow-hidden shadow-md flex flex-col p-3 select-none"
                style={{ minHeight: "410px" }}
              >
                {/* Feature 4 — State ghost watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] z-0">
                  {formData.state_code === "CA" ? (
                    <svg viewBox="0 0 100 100" className="w-[180px] h-[180px] text-slate-800" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M 15,65 C 15,60 18,52 22,50 C 25,48 28,52 30,50 C 32,48 35,42 40,40 C 45,38 52,35 58,40 C 60,42 62,45 65,42 C 68,39 72,32 76,33 C 78,34 80,38 82,41 C 85,45 88,48 90,52 C 92,56 88,60 85,58 C 83,56 82,53 80,55 C 78,57 76,62 75,65 L 70,65 C 69,60 67,55 66,56 C 65,57 65,62 65,65 L 58,65 C 58,58 55,54 52,55 C 49,56 48,61 48,65 L 40,65 C 40,58 37,55 35,56 C 33,57 32,62 32,65 L 25,65 C 25,58 22,55 20,56 C 18,57 17,62 17,65 Z" />
                      <polygon points="25,30 28,38 20,33 30,33 22,38" fill="currentColor" stroke="none" />
                    </svg>
                  ) : (
                    <span className="text-[120px] font-extrabold text-slate-800 select-none uppercase font-mono tracking-widest">
                      {formData.state_code || "VA"}
                    </span>
                  )}
                </div>

                {/* Main stack above watermark */}
                <div className="relative z-10 flex flex-col justify-between h-full flex-1 gap-2.5">
                  
                  {/* Top segment: Feature 2 — Printed magnetic track string & solid black magnetic stripe */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      {(() => {
                        const { track1, track2 } = generateTrackStrings(formData);
                        return (
                          <div className="border border-slate-350 rounded px-1.5 py-0.5 bg-slate-50/95 font-mono text-[9px] font-bold text-slate-850 tracking-tighter leading-tight max-w-full overflow-x-hidden">
                            <div>{track1}</div>
                            <div>{track2}</div>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Magnetic stripe */}
                    <div className="h-8 bg-slate-950 w-full rounded flex items-center justify-end px-3">
                      <div className="w-1 h-full bg-slate-800 opacity-40"></div>
                    </div>
                  </div>

                  {/* Middle row: Middle Left (Class info), Middle Right (PDF417 + sequence number) */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Middle left: Class codes */}
                    <div className="col-span-4 bg-slate-50/85 backdrop-blur-[1px] border border-slate-150 p-1.5 rounded-md text-left font-mono text-[9px] leading-tight flex flex-col gap-1">
                      <div>
                        <span className="font-extrabold text-slate-400 block text-[8px] uppercase">CLASS</span>
                        <span className="font-bold text-slate-900">{formData.vehicle_class || "C"}</span>
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-400 block text-[8px] uppercase">REST</span>
                        <span className="font-bold text-slate-900 truncate max-w-full block text-[8px]">{formData.restrictions || "NONE"}</span>
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-400 block text-[8px] uppercase">ENDO</span>
                        <span className="font-bold text-slate-900 truncate max-w-full block text-[8px]">{formData.endorsements || "NONE"}</span>
                      </div>
                    </div>

                    {/* Middle right: PDF417 Canvas + sequence label */}
                    <div className="col-span-8 flex flex-col items-end gap-0.5">
                      <div className="w-full bg-white border border-slate-200 p-1 flex items-center justify-center min-h-[95px] relative rounded-md shadow-inner overflow-hidden pr-7">
                        <div id="pdf417Placeholder" className="absolute text-slate-400 font-mono text-[10px] italic pointer-events-none select-none">
                          Generating barcode...
                        </div>
                        <canvas 
                          id="pdf417Canvas"
                          className="max-w-[calc(100%-14px)] max-h-[85px] object-contain"
                          style={{ display: "none" }}
                        />
                        {/* Sequence number (6 digits, rotated 90° on right edge of PDF417 section) */}
                        <div className="absolute right-[2px] top-1/2 -translate-y-1/2 rotate-90 origin-center text-[7.5px] font-mono font-extrabold text-slate-500 uppercase tracking-wider select-none leading-none whitespace-nowrap">
                          {`*718392*`}
                        </div>
                      </div>
                      <div className="flex justify-between w-full px-0.5 text-[8px] font-mono text-slate-500 font-extrabold">
                        <span>AAMVA 2D BARCODE</span>
                        <span>SEQ 718392</span>
                      </div>
                      {/* Disclaimer text next to/below PDF417 */}
                      <div className="text-[7.5px] text-slate-500 font-mono leading-tight mt-1 text-right select-none max-w-full">
                        This license is issued as a license to drive a motor vehicle in accordance with state laws.
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Center (Code 128), Right (Signature) */}
                  <div className="grid grid-cols-12 gap-2 items-end pt-1 border-t border-slate-100">
                    {/* Bottom center: Code 128 linear barcode */}
                    <div className="col-span-8 flex flex-col items-center">
                      <div className="w-full bg-white border border-slate-200 py-1 px-1.5 flex items-center justify-center min-h-[58px] relative rounded-md shadow-inner overflow-hidden">
                        <canvas 
                          id="code128Canvas"
                          className="max-w-[95%] max-h-[50px] object-contain"
                        />
                      </div>
                    </div>

                    {/* Bottom right: Signature Image */}
                    <div className="col-span-4 flex flex-col items-end justify-end gap-1 text-right pb-1">
                      <div className="flex flex-col items-center w-full">
                        {signatureData ? (
                          <img src={signatureData} alt="Signature Preview" className="h-[28px] max-w-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-[28px] flex items-end justify-center text-[7px] text-slate-400 font-mono italic">Awaiting Sign</div>
                        )}
                        <div className="w-full border-t border-slate-350 text-[7px] text-slate-400 uppercase tracking-widest text-center mt-0.5 whitespace-nowrap scale-[0.85]">
                          DL SIGNATURE
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Feature 3 — Bottom text: human readable text strip with right spacing for Rev date */}
                  {(() => {
                    const hgtVal = convertHeight(formData.height_feet || "5", formData.height_inches || "11").display;
                    const sexVal = (formData.sex || "M").toUpperCase();
                    const hairVal = formData.hair_color || 'BLK';
                    const eyeVal = formData.eye_color || 'BRN';
                    const wgtVal = formData.weight || '160';
                    const issueDateNoDash = formatDateAAMVA(formData.issue_date);
                    const issueDateDisplay = formatIssueDateDisplay(issueDateNoDash);

                    const line1 = `SEX ${sexVal}   HAIR ${hairVal}   EYES ${eyeVal}   HGT ${hgtVal}   WGT ${wgtVal} lb   ISS ${issueDateDisplay}`;
                    const docDisc = formData.document_discriminator || '0000000000';
                    const stateUpper = (formData.state_code || 'VA').toUpperCase();
                    const auditNum = getAuditNumber();
                    const line2 = `DD ${issueDateNoDash} ${docDisc}/${stateUpper}FD/${auditNum}    ISS ${issueDateDisplay}`;

                    return (
                      <div className="mr-28" style={{ marginLeft: '8px' }}>
                        <div className="font-mono text-[10px] text-[#333333] leading-normal text-left select-all whitespace-pre">
                          {`${line1}\n${line2}`}
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Rev date: absolute bottom-right, 10px margin from edges */}
                <div 
                  className="absolute bottom-[10px] right-[10px] font-mono z-30 pointer-events-none select-none font-bold"
                  style={{ fontSize: '11px', color: '#444444' }}
                >
                  {getRevDate()}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono tracking-wider uppercase flex justify-between w-full">
              <span>Card Back Mockup</span>
              <span>Pure Client-Side Encoded</span>
            </div>
          </div>

          {/* Digital Signature Result Section (Feature 1 requirement) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">Digital Signature</h3>
            
            {signatureData ? (
              <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-150 rounded-lg p-3">
                <div className="border border-slate-200 rounded p-1 bg-white flex items-center justify-center h-16 w-full max-w-[200px]">
                  <img src={signatureData} alt="Uploaded Digital Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1 text-center truncate max-w-full">
                  File: <span className="font-semibold text-slate-700">{signatureName}</span>
                </p>
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                No signature file uploaded. Placeholders are shown in active layout.
              </div>
            )}
          </div>

          {/* Bento box 2: ACTIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">PNG Exports</h3>
            
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDownloadPDF417}
                  disabled={!isGenerated}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold py-3 transition-colors text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Save PDF417 PNG
                </button>
                
                <button
                  onClick={handleDownloadCode128}
                  disabled={!isGenerated}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold py-3 transition-colors text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Save Code 128 PNG
                </button>
              </div>
            </div>
          </div>

          {/* Bento box 3: VERIFICATION DISPLAY (WHAT SCANNER WILL READ) */}
          <div className="bg-slate-900 rounded-xl shadow-md border border-slate-850 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 animate-pulse" />
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">What scanner will read</h3>
            </div>

            <div className="max-h-[300px] overflow-y-auto bg-slate-950 border border-slate-850 p-3.5 rounded-lg font-mono text-[11px] leading-relaxed text-slate-300">
              {encodedFields.length > 0 ? (
                <div className="space-y-1">
                  {encodedFields.map(([code, val]) => (
                    <div key={code} className="flex border-b border-slate-900/40 py-0.5 hover:bg-slate-900/30 transition-all">
                      <span className="font-extrabold text-indigo-400 w-12 shrink-0">{code}</span>
                      <span className="text-emerald-300 select-all">{val || 'NONE'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic uppercase tracking-wider text-center py-2">Awaiting payload generation...</p>
              )}
            </div>

            <div className="mt-3 text-[10px] text-slate-500 uppercase font-bold flex justify-between font-mono">
              <span>Fields count: {encodedFields.length}</span>
              <span>Timestamp: {generationTime}</span>
            </div>
          </div>

          {/* Bento box 4: RAW INPUT PAYLOAD FOR CONSOLE COPIES */}
          {isGenerated && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 text-slate-700">
                <Barcode className="w-4 h-4" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Raw Input Payload</h3>
              </div>
              <div className="max-h-[140px] overflow-y-auto bg-slate-50 border border-slate-150 p-3 rounded-lg">
                <pre className="font-mono text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed select-all">
                  {encodedText}
                </pre>
              </div>
              <div className="mt-2 text-[8px] text-slate-400 uppercase font-mono tracking-wider text-right">
                Standards Compliant AAMVA File Format
              </div>
            </div>
          )}

        </section>
      </main>

      {/* Bento-style footer */}
      <footer className="bg-white border-t py-3 px-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400 uppercase tracking-tighter gap-2 mt-auto">
        <div className="font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Pure Client-Side Generation Connected
        </div>
        <div>
          Institutional Standard • PDF417 & CODE 128
        </div>
      </footer>

    </div>
  );
}

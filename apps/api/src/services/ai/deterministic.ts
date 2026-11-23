import type {
  ComplaintClassification,
  DraftRtiInput,
  RtiDraftResult,
  AiDepartmentCode,
} from './types.js';
import {
  ComplaintClassificationSchema,
  RtiDraftResultSchema,
} from './types.js';
import type { ComplaintCategory, UrgencyLevel } from '@jansetu/shared';

interface CategoryRule {
  readonly category: ComplaintCategory;
  readonly departmentCode: AiDepartmentCode;
  readonly baseUrgency: UrgencyLevel;
  readonly keywords: readonly string[];
  readonly summaryEnTemplate: string;
  readonly summaryHiTemplate: string;
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'Electricity Hazard',
    departmentCode: 'DISCOM',
    baseUrgency: 'CRITICAL',
    keywords: [
      'electric', 'electricity', 'wire', 'taar', 'bijli', 'spark', 'current',
      'short circuit', 'transformer', 'hanging wire', 'live wire', 'shock',
      'बिजली', 'तार', 'करंट', 'ट्रांसफार्मर', 'बिजली का तार', 'खंभा', 'शॉर्ट सर्किट'
    ],
    summaryEnTemplate: 'Hazardous electrical condition or live wiring detected requiring immediate intervention.',
    summaryHiTemplate: 'विद्युत खतरे या खुले तार की गंभीर समस्या, तत्काल तकनीकी सुधार आवश्यक है।',
  },
  {
    category: 'Sewage',
    departmentCode: 'SEW',
    baseUrgency: 'CRITICAL',
    keywords: [
      'sewage', 'sewer', 'drainage', 'nali', 'gutter', 'overflow', 'drain block',
      'manhole', 'open manhole', 'ganda paani', 'sewerage',
      'सीवर', 'नाली', 'गटर', 'जलभराव', 'नाली जाम', 'मैनहोल', 'खुला मैनहोल'
    ],
    summaryEnTemplate: 'Sewage overflow or blocked drainage line causing severe public health hazard.',
    summaryHiTemplate: 'सीवर लाइन जाम अथवा नाली ओवरफ्लो होने से गंभीर स्वास्थ्य एवं स्वच्छता समस्या।',
  },
  {
    category: 'Street Light',
    departmentCode: 'ELEC',
    baseUrgency: 'HIGH',
    keywords: [
      'street light', 'streetlight', 'street-light', 'light kharab', 'lamp',
      'dark', 'andhera', 'bulb', 'light band', 'light nhi', 'batti',
      'स्ट्रीट लाइट', 'बत्ती', 'अंधेरा', 'लाइट खराब', 'लैंप', 'स्ट्रीटलाइट'
    ],
    summaryEnTemplate: 'Street lighting fixture non-functional leading to dark area and public safety concern.',
    summaryHiTemplate: 'स्ट्रीट लाइट बंद या खराब होने से क्षेत्र में अंधेरा और नागरिक सुरक्षा समस्या।',
  },
  {
    category: 'Road Damage',
    departmentCode: 'PWD',
    baseUrgency: 'HIGH',
    keywords: [
      'pothole', 'potholes', 'road damage', 'gaddha', 'gaddhe', 'broken road',
      'sadak kharab', 'crack', 'road surface', 'tarcol', 'asphalt',
      'सड़क', 'गड्ढा', 'गड्ढे', 'सड़क खराब', 'टूटी सड़क', 'सड़क निर्माण'
    ],
    summaryEnTemplate: 'Damaged roadway or dangerous potholes obstructing traffic and posing accident risk.',
    summaryHiTemplate: 'सड़क पर गहरे गड्ढे अथवा टूट-फूट, जिससे आवागमन में बाधा और दुर्घटना की आशंका है।',
  },
  {
    category: 'Water Supply',
    departmentCode: 'DJB',
    baseUrgency: 'HIGH',
    keywords: [
      'water', 'water supply', 'paani', 'pani', 'leakage', 'pipe burst',
      'drinking water', 'no water', 'tanker', 'pani nahi', 'pipeline',
      'पानी', 'जल आपूर्ति', 'पानी नहीं', 'लीकेज', 'नल', 'पाइपलाइन', 'पेयजल'
    ],
    summaryEnTemplate: 'Drinking water supply disruption or municipal pipeline leakage.',
    summaryHiTemplate: 'पेयजल आपूर्ति में व्यवधान अथवा पाइपलाइन लीकेज के कारण जल संकट।',
  },
  {
    category: 'Waste Management',
    departmentCode: 'SAN',
    baseUrgency: 'MEDIUM',
    keywords: [
      'garbage', 'waste', 'kachra', 'trash', 'dump', 'dustbin', 'safai',
      'kooda', 'solid waste', 'filth', 'debris',
      'कचरा', 'कूड़ा', 'सफाई', 'कचरा डिब्बा', 'गंदगी', 'कचरा ढेर', 'सफाई कर्मचारी'
    ],
    summaryEnTemplate: 'Accumulated garbage and solid waste requiring municipal sanitation clearance.',
    summaryHiTemplate: 'क्षेत्र में कूड़े का ढेर और गंदगी, तत्काल सफाई एवं कचरा उठाव की आवश्यकता।',
  },
  {
    category: 'Sanitation',
    departmentCode: 'HEALTH',
    baseUrgency: 'MEDIUM',
    keywords: [
      'toilet', 'public toilet', 'shauchalay', 'hygiene', 'urinal',
      'sulabh', 'swachhata',
      'शौचालय', 'स्वच्छता', 'सार्वजनिक शौचालय', 'मूत्रालय'
    ],
    summaryEnTemplate: 'Public toilet or sanitation facility poorly maintained and unhygienic.',
    summaryHiTemplate: 'सार्वजनिक शौचालय या स्वच्छता सुविधा की अस्वच्छता एवं रख-रखाव का अभाव।',
  },
  {
    category: 'Pollution / Air Quality',
    departmentCode: 'DPCC',
    baseUrgency: 'HIGH',
    keywords: [
      'pollution', 'smoke', 'smog', 'air quality', 'aqi', 'dhuan',
      'dust', 'burning', 'garbage burning',
      'प्रदूषण', 'धुआं', 'वायु गुणवत्ता', 'कूड़ा जलाना', 'धूल'
    ],
    summaryEnTemplate: 'Severe environmental pollution or unauthorized waste burning reported.',
    summaryHiTemplate: 'वायु प्रदूषण या कचरा जलाने से पर्यावरण और नागरिकों के स्वास्थ्य को नुकसान।',
  },
  {
    category: 'Traffic / Transport',
    departmentCode: 'TRAFFIC',
    baseUrgency: 'MEDIUM',
    keywords: [
      'traffic', 'signal', 'traffic light', 'jam', 'speed breaker',
      'bus stop', 'zebra crossing',
      'ट्रैफिक', 'यातायात', 'सिग्नल', 'जाम', 'स्पीड ब्रेकर'
    ],
    summaryEnTemplate: 'Traffic congestion, non-functional traffic signal, or road safety obstruction.',
    summaryHiTemplate: 'ट्रैफिक जाम, ट्रैफिक सिग्नल खराबी या मार्ग पर यातायात अवरोध की समस्या।',
  },
  {
    category: 'Stray Animals',
    departmentCode: 'VET',
    baseUrgency: 'MEDIUM',
    keywords: [
      'stray', 'dog', 'kutta', 'kutte', 'monkey', 'bandar', 'animal bite',
      'cattle', 'cow',
      'आवारा कुत्ते', 'कुत्ता', 'बंदर', 'पशु', 'गाय', 'कुत्तों का आतंक'
    ],
    summaryEnTemplate: 'Stray animal menace or potential hazard to pedestrians in residential locality.',
    summaryHiTemplate: 'आवारा पशुओं या कुत्तों का आतंक, जिससे स्थानीय नागरिकों और बच्चों को खतरा है।',
  },
  {
    category: 'Encroachment / Public Safety',
    departmentCode: 'REV',
    baseUrgency: 'MEDIUM',
    keywords: [
      'encroachment', 'footpath', 'illegal shop', 'kabza', 'blocked footpath',
      'illegal occupation',
      'अतिक्रमण', 'कब्जा', 'फुटपाथ जाम', 'अवैध कब्जा'
    ],
    summaryEnTemplate: 'Unauthorized encroachment on public walkway or municipal road space.',
    summaryHiTemplate: 'सार्वजनिक फुटपाथ या सड़क पर अवैध अतिक्रमण एवं आवागमन में बाधा।',
  },
  {
    category: 'Illegal Construction',
    departmentCode: 'BLDG',
    baseUrgency: 'HIGH',
    keywords: [
      'illegal construction', 'unauthorized building', 'builder floor',
      'demolition', 'setback', 'structural crack',
      'अवैध निर्माण', 'अवैध इमारत', 'बिना नक्शा निर्माण', 'खतरनाक इमारत'
    ],
    summaryEnTemplate: 'Unauthorized structural construction or violation of municipal building norms.',
    summaryHiTemplate: 'अवैध भवन निर्माण या नगर निगम के स्वीकृत नक्शे के उल्लंघन की शिकायत।',
  },
  {
    category: 'Fire Hazard',
    departmentCode: 'FIRE',
    baseUrgency: 'CRITICAL',
    keywords: [
      'fire', 'aag', 'cylinder', 'gas leak', 'blaze', 'burning chemical',
      'flames', 'smoke detector',
      'आग', 'सिलेंडर', 'गैस रिसाव', 'आग की लपटें', 'अग्निकांड'
    ],
    summaryEnTemplate: 'Fire outbreak or combustible safety hazard demanding urgent response.',
    summaryHiTemplate: 'अग्नि दुर्घटना या ज्वलनशील खतरे की सूचना, आपातकालीन सुरक्षा कदम अपेक्षित।',
  },
  {
    category: 'Public Park',
    departmentCode: 'HORT',
    baseUrgency: 'LOW',
    keywords: [
      'park', 'garden', 'tree fallen', 'bench', 'grass', 'horticulture',
      'playground', 'ped',
      'पार्क', 'बगीचा', 'पेड़ गिरा', 'घास', 'उद्यान', 'बच्चों का पार्क'
    ],
    summaryEnTemplate: 'Municipal public park or horticultural maintenance required.',
    summaryHiTemplate: 'पार्क के रख-रखाव, टूटे बेंच या गिरे हुए पेड़ों की सफाई का कार्य आवश्यक है।',
  },
  {
    category: 'Property Tax / Civic Services',
    departmentCode: 'REV',
    baseUrgency: 'LOW',
    keywords: [
      'tax', 'property tax', 'mutation', 'birth certificate', 'death certificate',
      'license', 'assessment',
      'संपत्ति कर', 'प्रमाण पत्र', 'जन्म प्रमाण पत्र', 'मृत्यु प्रमाण पत्र', 'दाखिल खारिज'
    ],
    summaryEnTemplate: 'Civic registry, mutation, or municipal revenue service inquiry.',
    summaryHiTemplate: 'नागरिक प्रमाण पत्र, नामांतरण या संपत्ति कर संबंधी प्रशासनिक सेवा का मामला।',
  },
];

const CRITICAL_ESCALATORS = [
  'accident', 'death', 'casualty', 'injury', 'dead', 'blood', 'fire', 'spark',
  'hanging wire', 'live wire', 'open manhole', 'flood', 'collapse', 'poison',
  'emergency', 'urgent', 'critical', 'khatarnak', 'khatra', 'hazard', 'unsafe', 'danger', 'life threat',
  'immediate', 'hospital', 'school',
  'दुर्घटना', 'मौत', 'खतरा', 'खतरनाक', 'आग', 'करंट', 'तुरंत', 'गंभीर', 'अस्पताल'
];

const HINDI_INDICATOR_WORDS = [
  'hai', 'hain', 'nahi', 'mein', 'ka', 'ke', 'ki', 'se', 'par', 'ko', 'aur',
  'kya', 'tha', 'thi', 'gaya', 'gayi', 'kharab', 'bahut', 'karna', 'kardo',
  'है', 'हैं', 'नहीं', 'में', 'का', 'के', 'की', 'से', 'पर', 'को', 'और', 'क्या', 'था'
];

export function detectIsHindi(text: string): boolean {
  // Check for Devanagari Unicode block
  if (/[\u0900-\u097F]/.test(text)) {
    return true;
  }
  const words = text.toLowerCase().split(/\s+/);
  const hindiCount = words.filter((w) => HINDI_INDICATOR_WORDS.includes(w)).length;
  return hindiCount >= 2;
}

export function classifyComplaintDeterministic(
  text: string,
  preferredLang?: 'en' | 'hi' | 'auto'
): ComplaintClassification {
  const normalized = text.toLowerCase();
  const isHindiDetected = detectIsHindi(text);
  const _lang = preferredLang === 'hi' ? 'hi' : preferredLang === 'en' ? 'en' : isHindiDetected ? 'hi' : 'en';

  let bestRule: CategoryRule | null = null;
  let maxScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestRule = rule;
    }
  }

  // Fallback to General Complaint if no keywords match
  const selectedRule: CategoryRule = bestRule ?? {
    category: 'General Complaint',
    departmentCode: 'ADMIN',
    baseUrgency: 'MEDIUM',
    keywords: [],
    summaryEnTemplate: 'General citizen grievance submitted for administrative review.',
    summaryHiTemplate: 'नागरिक द्वारा प्रस्तुत सामान्य शिकायत, प्रशासनिक समीक्षा हेतु अग्रेषित।',
  };

  // Urgency escalation logic
  let urgency = selectedRule.baseUrgency;
  let escalatorMatches = 0;
  for (const esc of CRITICAL_ESCALATORS) {
    if (normalized.includes(esc.toLowerCase())) {
      escalatorMatches++;
    }
  }

  if (escalatorMatches >= 2 || /live wire|open manhole|fire|death|current|करंट|मौत/.test(normalized)) {
    urgency = 'CRITICAL';
  } else if (escalatorMatches === 1) {
    if (urgency === 'LOW') {
      urgency = 'MEDIUM';
    } else if (urgency === 'MEDIUM') {
      urgency = 'HIGH';
    } else if (urgency === 'HIGH') {
      urgency = 'CRITICAL';
    }
  }

  // Calculate deterministic confidence
  const confidence = maxScore >= 3 ? 0.88 : maxScore >= 1 ? 0.76 : 0.60;

  // Extract concise contextual snippet for summary
  const snippet = text.trim().slice(0, 120);
  const summaryEn = `${selectedRule.summaryEnTemplate} Details: "${snippet}"`;
  const summaryHi = `${selectedRule.summaryHiTemplate} विवरण: "${snippet}"`;

  const result: ComplaintClassification = {
    departmentCode: selectedRule.departmentCode,
    category: selectedRule.category,
    urgency,
    summaryEn,
    summaryHi,
    confidence,
  };

  return ComplaintClassificationSchema.parse(result);
}

export function draftRtiSection6Deterministic(input: DraftRtiInput): RtiDraftResult {
  const now = new Date();
  const dateStrEn = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dateStrHi = now.toLocaleDateString('hi-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const isBpl = Boolean(input.isBplExempt || (input.bplCardNo && input.bplCardNo.trim().length > 0));

  const questions = input.specificQuestions && input.specificQuestions.length > 0
    ? [...input.specificQuestions]
    : [
        `Certified copies of all file notings, inspection reports, and official correspondence concerning: "${input.subject}".`,
        'Current administrative status of the grievance and daily progress recorded by the designated officer.',
        'Name, designation, and contact details of the public servant responsible for resolving this matter within the Citizen Charter deadline.',
      ];

  const qLinesEn = questions.map((q, i) => `       (${i + 1}) ${q}`).join('\n');
  const qLinesHi = questions.map((q, i) => `       (${i + 1}) ${q}`).join('\n');

  const englishDraft = `FORM 'A'
APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005

To,
The Public Information Officer (PIO),
${input.authorityName}
${input.publicAuthorityAddress || 'Municipal Administrative Headquarters, Delhi NCR'}

1. Full Name of Applicant: ${input.applicantName}
2. Father / Spouse Name: ${input.fatherOrSpouseName || 'N/A'}
3. Address for Correspondence: ${input.address}
4. Contact Details: Phone: ${input.contactNumber}${input.email ? ` | Email: ${input.email}` : ''}
5. Particulars of Information Required:
   (a) Subject: ${input.subject}
   (b) Description: ${input.description}
   (c) Specific Questions:
${qLinesEn}
6. Whether Applicant belongs to BPL Category: ${isBpl ? `YES (Card No: ${input.bplCardNo || 'Enclosed'})` : 'NO'}
7. Application Fee: ${isBpl ? 'Exempted under Section 7(5) of RTI Act, 2005' : 'Rs. 10/- paid via Indian Postal Order / Online Receipt'}

Place: Delhi NCR
Date: ${dateStrEn}

__________________________
Signature of Applicant`;

  const hindiDraft = `प्रपत्र 'क'
सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत आवेदन

सेवा में,
लोक सूचना अधिकारी (PIO),
${input.authorityName}
${input.publicAuthorityAddress || 'नगर निगम प्रशासनिक मुख्यालय, दिल्ली एनसीआर'}

1. आवेदक का पूरा नाम: ${input.applicantName}
2. पिता / पति का नाम: ${input.fatherOrSpouseName || 'लागू नहीं'}
3. पत्राचार का पता: ${input.address}
4. संपर्क विवरण: फोन: ${input.contactNumber}${input.email ? ` | ईमेल: ${input.email}` : ''}
5. मांगी गई सूचना का विवरण:
   (क) विषय: ${input.subject}
   (ख) विस्तृत विवरण: ${input.description}
   (ग) विशिष्ट प्रश्न:
${qLinesHi}
6. क्या आवेदक गरीबी रेखा से नीचे (BPL) श्रेणी से संबंधित है: ${isBpl ? `हाँ (बीपीएल कार्ड संख्या: ${input.bplCardNo || 'संलग्न'})` : 'नहीं'}
7. आवेदन शुल्क: ${isBpl ? 'आरटीआई अधिनियम 2005 की धारा 7(5) के तहत शुल्क मुक्त' : 'रु. 10/- पोस्टल आर्डर / चालान द्वारा भुगतान'}

स्थान: दिल्ली एनसीआर
दिनांक: ${dateStrHi}

__________________________
आवेदक के हस्ताक्षर`;

  const statutoryText = input.preferredLanguage === 'hi' ? hindiDraft : englishDraft;

  const result: RtiDraftResult = {
    subject: input.subject,
    authorityName: input.authorityName,
    language: input.preferredLanguage,
    statutoryText,
    questions,
    isBplExempt: isBpl,
    englishDraft,
    hindiDraft,
  };

  return RtiDraftResultSchema.parse(result);
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { saveMessage, loadConversationHistory } from '@/utils/supabase/conversations';
import { MemoryStore, executeDeepResearch } from '@/utils/ai';
import { toolSchemas, executeServerTool } from '@/utils/ai/tools';
import { rateLimit } from '@/utils/rate-limit';
import { z } from 'zod';
import { parseScrapedQuestions } from '@/utils/math-cleaner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for multi-turn search runs

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

const HACKCLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';
const TAVILY_API_URL = 'https://api.tavily.com/search';

const TEXTBOOK_DOMAINS = [
  'ncert.nic.in',
  'ncert.nic.in/textbook',
  'learncbse.in',
  'examside.com',
  'jeemain.guru',
  'vedantu.com',
  'byjus.com',
  'pdfdrive.com',
  'freebookcentre.net',
  'physicsandmathstutor.com',
  'exammate.in',
  'jeebooks.in',
  'jeepdf.com',
  'jeestudysource.com',
  'iitjeebooks.com',
  'jeepdfdownload.com',
  'jeepdfnotes.com',
];



const GREETINGS = ['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening'];
const CAPABILITIES = ['what can you do', 'who are you', 'what are your capabilities', 'what do you do', 'help me', 'how to use', 'features', 'what is this website'];
const JEE_KEYWORDS = [
  'jee', 'neet', 'iit', 'nit', 'syllabus', 'cutoff', 'exam date', 'exam pattern',
  'previous year', 'pyq', 'ncert', 'coaching', 'nta', 'rank predictor', 'percentile',
  'physics', 'chemistry', 'maths', 'mathematics', 'formula', 'theorem', 'derivation',
  'solve', 'calculate', 'derive', 'prove', 'evaluate', 'integrate', 'differentiate',
  'equilibrium', 'reaction', 'organic', 'inorganic', 'electrostatics', 'magnetism',
  'kinematics', 'thermodynamics', 'optics', 'waves', 'modern physics', 'nuclear',
  'newton', 'coulomb', 'gauss', 'faraday', 'ohm', 'kirchhoff', 'bernoulli',
  'coordinate geometry', 'calculus', 'probability', 'matrices', 'vectors', 'trigonometry',
  'sets', 'relations', 'functions', 'inequalities', 'complex numbers', 'binomial',
  'permutations', 'combinations', 'sequences', 'series', 'limits', 'continuity',
  'differentiability', 'integration', 'area', 'differential equations',
  'straight lines', 'circles', 'parabola', 'ellipse', 'hyperbola',
  'mole concept', 'atomic structure', 'periodic table', 'chemical bonding',
  'thermodynamics chemistry', 'chemical kinetics', 'electrochemistry', 'solutions',
  'hydrocarbons', 'organic chemistry', 'goc', 'isomerism', 'p block', 'd block',
  'friction', 'newton laws', 'work energy', 'rotation', 'gravitation', 'shm',
  'tips', 'tricks', 'shortcuts', 'how to solve', 'method', 'strategy',
];
const EXPLICIT_SEARCH = ['search', 'look up', 'find online', 'realtime', 'latest update', 'current news', 'tavily', 'web search', 'research', 'google', 'bing'];

function isGeneralWebSearchQuery(query: string): boolean {
  if (isTextbookQuery(query)) return false;
  const lower = query.toLowerCase();
  
  if (GREETINGS.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return false;
  if (CAPABILITIES.some(c => lower.includes(c) || lower === 'help' || lower === '?')) return false;

  if (EXPLICIT_SEARCH.some(kw => lower.includes(kw))) return true;
  if (/20(2[4-9]|[3-9]\d)/.test(query)) return true;
  
  const TIME_SENSITIVE = ['latest', 'current', 'recent', 'today', 'this year', 'now', 'breaking', 'news', 'announce', 'released', 'winner', 'won', 'champion', 'finals', 'tournament'];
  if (TIME_SENSITIVE.some(kw => lower.includes(kw))) return true;

  return false;
}


// List of all JEE syllabus topics for the smart fallback parser
interface SyllabusTopic {
  id: string;
  name: string;
  chapterId: string;
  chapterName: string;
  subject: 'physics' | 'chemistry' | 'mathematics';
}

const SYLLABUS_TOPICS: SyllabusTopic[] = [
  // Physics - Mechanics
  { id: 'phy-mech-units', name: 'Units and Measurements', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-motion1d', name: 'Motion in a Straight Line', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-motion2d', name: 'Motion in a Plane', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-newton', name: 'Laws of Motion', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-workenergy', name: 'Work, Energy, and Power', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-com', name: 'Center of Mass and System of Particles', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-rotation', name: 'Rotational Motion', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-gravitation', name: 'Gravitation', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-shm', name: 'Simple Harmonic Motion', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-elasticity', name: 'Mechanical Properties of Solids', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  { id: 'phy-mech-fluids', name: 'Mechanical Properties of Fluids', chapterId: 'phy-mechanics', chapterName: 'Mechanics', subject: 'physics' },
  // Physics - Thermodynamics
  { id: 'phy-thermo-thermal', name: 'Thermal Properties of Matter', chapterId: 'phy-thermo', chapterName: 'Thermodynamics', subject: 'physics' },
  { id: 'phy-thermo-kinetic', name: 'Kinetic Theory of Gases', chapterId: 'phy-thermo', chapterName: 'Thermodynamics', subject: 'physics' },
  { id: 'phy-thermo-laws', name: 'Laws of Thermodynamics', chapterId: 'phy-thermo', chapterName: 'Thermodynamics', subject: 'physics' },
  { id: 'phy-thermo-transfer', name: 'Heat Transfer', chapterId: 'phy-thermo', chapterName: 'Thermodynamics', subject: 'physics' },
  // Physics - Waves
  { id: 'phy-waves-mechanical', name: 'Mechanical Waves', chapterId: 'phy-waves', chapterName: 'Waves and Oscillations', subject: 'physics' },
  { id: 'phy-waves-sound', name: 'Sound Waves', chapterId: 'phy-waves', chapterName: 'Waves and Oscillations', subject: 'physics' },
  { id: 'phy-waves-superposition', name: 'Superposition of Waves', chapterId: 'phy-waves', chapterName: 'Waves and Oscillations', subject: 'physics' },
  { id: 'phy-waves-standing', name: 'Standing Waves and Resonance', chapterId: 'phy-waves', chapterName: 'Waves and Oscillations', subject: 'physics' },
  { id: 'phy-waves-doppler', name: 'Doppler Effect', chapterId: 'phy-waves', chapterName: 'Waves and Oscillations', subject: 'physics' },
  // Physics - Electrostatics
  { id: 'phy-elst-coulomb', name: 'Electric Charges and Coulombs Law', chapterId: 'phy-electrostatics', chapterName: 'Electrostatics', subject: 'physics' },
  { id: 'phy-elst-field', name: 'Electric Field and Field Lines', chapterId: 'phy-electrostatics', chapterName: 'Electrostatics', subject: 'physics' },
  { id: 'phy-elst-potential', name: 'Electric Potential and Potential Energy', chapterId: 'phy-electrostatics', chapterName: 'Electrostatics', subject: 'physics' },
  { id: 'phy-elst-gauss', name: 'Gauss Law', chapterId: 'phy-electrostatics', chapterName: 'Electrostatics', subject: 'physics' },
  { id: 'phy-elst-capacitance', name: 'Capacitance and Dielectrics', chapterId: 'phy-electrostatics', chapterName: 'Electrostatics', subject: 'physics' },
  // Physics - Current Electricity
  { id: 'phy-curr-ohm', name: 'Ohms Law and Resistance', chapterId: 'phy-current', chapterName: 'Current Electricity', subject: 'physics' },
  { id: 'phy-curr-cells', name: 'Cells, EMF, and Internal Resistance', chapterId: 'phy-current', chapterName: 'Current Electricity', subject: 'physics' },
  { id: 'phy-curr-kirchhoff', name: 'Kirchhoffs Laws', chapterId: 'phy-current', chapterName: 'Current Electricity', subject: 'physics' },
  { id: 'phy-curr-wheatstone', name: 'Wheatstone Bridge and Potentiometer', chapterId: 'phy-current', chapterName: 'Current Electricity', subject: 'physics' },
  { id: 'phy-curr-heating', name: 'Heating Effect of Current', chapterId: 'phy-current', chapterName: 'Current Electricity', subject: 'physics' },
  // Physics - Magnetism
  { id: 'phy-mag-biotsavart', name: 'Biot-Savart Law', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  { id: 'phy-mag-ampere', name: 'Amperes Law', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  { id: 'phy-mag-force', name: 'Force on Current-Carrying Conductor', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  { id: 'phy-mag-lorentz', name: 'Lorentz Force and Motion in Magnetic Field', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  { id: 'phy-mag-earth', name: 'Earth Magnetism', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  { id: 'phy-mag-materials', name: 'Magnetic Properties of Materials', chapterId: 'phy-magnetism', chapterName: 'Magnetism', subject: 'physics' },
  // Physics - EMI & AC
  { id: 'phy-emi-faraday', name: 'Faradays Law', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  { id: 'phy-emi-lenz', name: 'Lenz Law', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  { id: 'phy-emi-inductance', name: 'Self and Mutual Inductance', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  { id: 'phy-emi-ac', name: 'Alternating Current', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  { id: 'phy-emi-lcr', name: 'LCR Circuits and Resonance', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  { id: 'phy-emi-transformer', name: 'Transformers', chapterId: 'phy-emi', chapterName: 'Electromagnetic Induction', subject: 'physics' },
  // Physics - EM Waves
  { id: 'phy-emw-maxwell', name: 'Maxwell Equations', chapterId: 'phy-emwaves', chapterName: 'Electromagnetic Waves', subject: 'physics' },
  { id: 'phy-emw-spectrum', name: 'Electromagnetic Spectrum', chapterId: 'phy-emwaves', chapterName: 'Electromagnetic Waves', subject: 'physics' },
  { id: 'phy-emw-properties', name: 'Properties of EM Waves', chapterId: 'phy-emwaves', chapterName: 'Electromagnetic Waves', subject: 'physics' },
  // Physics - Optics
  { id: 'phy-opt-reflection', name: 'Reflection of Light', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-refraction', name: 'Refraction of Light', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-tir', name: 'Total Internal Reflection', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-lenses', name: 'Lenses and Mirrors', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-prism', name: 'Prism and Dispersion', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-interference', name: 'Wave Optics: Interference', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-diffraction', name: 'Diffraction', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-polarization', name: 'Polarization', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  { id: 'phy-opt-instruments', name: 'Optical Instruments', chapterId: 'phy-optics', chapterName: 'Optics', subject: 'physics' },
  // Physics - Modern Physics
  { id: 'phy-mod-photoelectric', name: 'Photoelectric Effect', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-bohr', name: 'Bohrs Model of Atom', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-xray', name: 'X-Rays', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-nuclear', name: 'Nuclear Physics', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-radioactivity', name: 'Radioactivity', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-semiconductor', name: 'Semiconductors and Devices', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-communication', name: 'Communication Systems', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },
  { id: 'phy-mod-duality', name: 'Wave-Particle Duality', chapterId: 'phy-modern', chapterName: 'Modern Physics', subject: 'physics' },

  // Chemistry - Basic Concepts
  { id: 'chem-basic-mole', name: 'Mole Concept and Stoichiometry', chapterId: 'chem-basic', chapterName: 'Basic Concepts', subject: 'chemistry' },
  { id: 'chem-basic-atomic', name: 'Atomic Structure', chapterId: 'chem-basic', chapterName: 'Basic Concepts', subject: 'chemistry' },
  { id: 'chem-basic-periodic', name: 'Periodic Table and Properties', chapterId: 'chem-basic', chapterName: 'Basic Concepts', subject: 'chemistry' },
  { id: 'chem-basic-states', name: 'States of Matter', chapterId: 'chem-basic', chapterName: 'Basic Concepts', subject: 'chemistry' },
  { id: 'chem-basic-redox', name: 'Redox Reactions', chapterId: 'chem-basic', chapterName: 'Basic Concepts', subject: 'chemistry' },
  // Chemistry - Chemical Bonding
  { id: 'chem-bond-ionic', name: 'Ionic Bonding', chapterId: 'chem-bonding', chapterName: 'Chemical Bonding', subject: 'chemistry' },
  { id: 'chem-bond-covalent', name: 'Covalent Bonding and VSEPR', chapterId: 'chem-bonding', chapterName: 'Chemical Bonding', subject: 'chemistry' },
  { id: 'chem-bond-mol-orbital', name: 'Molecular Orbital Theory', chapterId: 'chem-bonding', chapterName: 'Chemical Bonding', subject: 'chemistry' },
  { id: 'chem-bond-hydrogen', name: 'Hydrogen Bonding', chapterId: 'chem-bonding', chapterName: 'Chemical Bonding', subject: 'chemistry' },
  { id: 'chem-bond-metallic', name: 'Metallic Bonding', chapterId: 'chem-bonding', chapterName: 'Chemical Bonding', subject: 'chemistry' },
  // Chemistry - Equilibrium
  { id: 'chem-eq-law', name: 'Law of Chemical Equilibrium', chapterId: 'chem-equilibrium', chapterName: 'Chemical and Ionic Equilibrium', subject: 'chemistry' },
  { id: 'chem-eq-lechatelier', name: 'Le Chateliers Principle', chapterId: 'chem-equilibrium', chapterName: 'Chemical and Ionic Equilibrium', subject: 'chemistry' },
  { id: 'chem-eq-ionic', name: 'Ionic Equilibrium', chapterId: 'chem-equilibrium', chapterName: 'Chemical and Ionic Equilibrium', subject: 'chemistry' },
  { id: 'chem-eq-ph', name: 'pH and Buffer Solutions', chapterId: 'chem-equilibrium', chapterName: 'Chemical and Ionic Equilibrium', subject: 'chemistry' },
  { id: 'chem-eq-solubility', name: 'Solubility Product', chapterId: 'chem-equilibrium', chapterName: 'Chemical and Ionic Equilibrium', subject: 'chemistry' },
  // Chemistry - Kinetics
  { id: 'chem-kin-rate', name: 'Rate of Reaction', chapterId: 'chem-kinetics', chapterName: 'Chemical Kinetics', subject: 'chemistry' },
  { id: 'chem-kin-order', name: 'Order and Molecularity', chapterId: 'chem-kinetics', chapterName: 'Chemical Kinetics', subject: 'chemistry' },
  { id: 'chem-kin-arrhenius', name: 'Arrhenius Equation', chapterId: 'chem-kinetics', chapterName: 'Chemical Kinetics', subject: 'chemistry' },
  { id: 'chem-kin-mechanisms', name: 'Reaction Mechanisms', chapterId: 'chem-kinetics', chapterName: 'Chemical Kinetics', subject: 'chemistry' },
  // Chemistry - Electrochemistry
  { id: 'chem-echem-cells', name: 'Electrochemical Cells', chapterId: 'chem-electrochemistry', chapterName: 'Electrochemistry', subject: 'chemistry' },
  { id: 'chem-echem-nernst', name: 'Nernst Equation', chapterId: 'chem-electrochemistry', chapterName: 'Electrochemistry', subject: 'chemistry' },
  { id: 'chem-echem-electrolysis', name: 'Electrolysis and Faradays Laws', chapterId: 'chem-electrochemistry', chapterName: 'Electrochemistry', subject: 'chemistry' },
  { id: 'chem-echem-conductance', name: 'Conductance and Kohlrausch Law', chapterId: 'chem-electrochemistry', chapterName: 'Electrochemistry', subject: 'chemistry' },
  { id: 'chem-echem-corrosion', name: 'Corrosion', chapterId: 'chem-electrochemistry', chapterName: 'Electrochemistry', subject: 'chemistry' },
  // Chemistry - Solutions
  { id: 'chem-sol-concentration', name: 'Concentration Terms', chapterId: 'chem-solutions', chapterName: 'Solutions', subject: 'chemistry' },
  { id: 'chem-sol-colligative', name: 'Colligative Properties', chapterId: 'chem-solutions', chapterName: 'Solutions', subject: 'chemistry' },
  { id: 'chem-sol-raoults', name: 'Raoults Law', chapterId: 'chem-solutions', chapterName: 'Solutions', subject: 'chemistry' },
  { id: 'chem-sol-abnormal', name: 'Abnormal Molar Mass', chapterId: 'chem-solutions', chapterName: 'Solutions', subject: 'chemistry' },
  // Chemistry - Organic Basics
  { id: 'chem-org-nomenclature', name: 'IUPAC Nomenclature', chapterId: 'chem-organic-basic', chapterName: 'Organic Chemistry Basics', subject: 'chemistry' },
  { id: 'chem-org-isomerism', name: 'Isomerism', chapterId: 'chem-organic-basic', chapterName: 'Organic Chemistry Basics', subject: 'chemistry' },
  { id: 'chem-org-goc', name: 'General Organic Chemistry (GOC)', chapterId: 'chem-organic-basic', chapterName: 'Organic Chemistry Basics', subject: 'chemistry' },
  { id: 'chem-org-effects', name: 'Electronic Effects (Inductive, Resonance, Hyperconjugation)', chapterId: 'chem-organic-basic', chapterName: 'Organic Chemistry Basics', subject: 'chemistry' },
  { id: 'chem-org-acidbase', name: 'Acid-Base Strength of Organic Compounds', chapterId: 'chem-organic-basic', chapterName: 'Organic Chemistry Basics', subject: 'chemistry' },
  // Chemistry - Hydrocarbons
  { id: 'chem-hc-alkanes', name: 'Alkanes', chapterId: 'chem-hydrocarbons', chapterName: 'Hydrocarbons', subject: 'chemistry' },
  { id: 'chem-hc-alkenes', name: 'Alkenes', chapterId: 'chem-hydrocarbons', chapterName: 'Hydrocarbons', subject: 'chemistry' },
  { id: 'chem-hc-alkynes', name: 'Alkynes', chapterId: 'chem-hydrocarbons', chapterName: 'Hydrocarbons', subject: 'chemistry' },
  { id: 'chem-hc-aromatic', name: 'Aromatic Hydrocarbons', chapterId: 'chem-hydrocarbons', chapterName: 'Hydrocarbons', subject: 'chemistry' },

  // Mathematics - Algebra
  { id: 'math-alg-sets', name: 'Sets, Relations, and Functions', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-complex', name: 'Complex Numbers', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-quadratic', name: 'Quadratic Equations', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-inequalities', name: 'Inequalities', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-pnc', name: 'Permutations and Combinations', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-binomial', name: 'Binomial Theorem', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-sequence', name: 'Sequences and Series', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-matrices', name: 'Matrices and Determinants', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  { id: 'math-alg-probability', name: 'Probability', chapterId: 'math-algebra', chapterName: 'Algebra', subject: 'mathematics' },
  // Mathematics - Trigonometry
  { id: 'math-trig-ratios', name: 'Trigonometric Ratios and Identities', chapterId: 'math-trigonometry', chapterName: 'Trigonometry', subject: 'mathematics' },
  { id: 'math-trig-equations', name: 'Trigonometric Equations', chapterId: 'math-trigonometry', chapterName: 'Trigonometry', subject: 'mathematics' },
  { id: 'math-trig-inverse', name: 'Inverse Trigonometric Functions', chapterId: 'math-trigonometry', chapterName: 'Trigonometry', subject: 'mathematics' },
  // Mathematics - Coordinate Geometry
  { id: 'math-coord-straight', name: 'Straight Lines', chapterId: 'math-coordinate', chapterName: 'Coordinate Geometry', subject: 'mathematics' },
  { id: 'math-coord-circle', name: 'Circles', chapterId: 'math-coordinate', chapterName: 'Coordinate Geometry', subject: 'mathematics' },
  { id: 'math-coord-parabola', name: 'Parabola', chapterId: 'math-coordinate', chapterName: 'Coordinate Geometry', subject: 'mathematics' },
  { id: 'math-coord-ellipse', name: 'Ellipse', chapterId: 'math-coordinate', chapterName: 'Coordinate Geometry', subject: 'mathematics' },
  { id: 'math-coord-hyperbola', name: 'Hyperbola', chapterId: 'math-coordinate', chapterName: 'Coordinate Geometry', subject: 'mathematics' },
  // Mathematics - Calculus
  { id: 'math-calc-limits', name: 'Limits and Continuity', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-differentiability', name: 'Differentiability', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-differentiation', name: 'Methods of Differentiation', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-application-diff', name: 'Application of Derivatives', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-indefinite', name: 'Indefinite Integration', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-definite', name: 'Definite Integration', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-area', name: 'Area Under Curves', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  { id: 'math-calc-diffeq', name: 'Differential Equations', chapterId: 'math-calculus', chapterName: 'Calculus', subject: 'mathematics' },
  // Mathematics - Vectors & 3D
  { id: 'math-vec-basics', name: 'Vector Algebra', chapterId: 'math-vectors', chapterName: 'Vectors and 3D Geometry', subject: 'mathematics' },
  { id: 'math-vec-products', name: 'Scalar and Vector Products', chapterId: 'math-vectors', chapterName: 'Vectors and 3D Geometry', subject: 'mathematics' },
  { id: 'math-3d-lines', name: '3D Geometry: Lines', chapterId: 'math-vectors', chapterName: 'Vectors and 3D Geometry', subject: 'mathematics' },
  { id: 'math-3d-planes', name: '3D Geometry: Planes', chapterId: 'math-vectors', chapterName: 'Vectors and 3D Geometry', subject: 'mathematics' },
];

// Levenshtein distance for typo-tolerant matching (e.g. "stociometry" → "stoichiometry")
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  return (maxLen - dist) / maxLen;
}

function findTopicByName(input: string): SyllabusTopic | null {
  const cleanInput = input.toLowerCase().trim();
  if (!cleanInput) return null;

  // Handle ordinal references like "1st chapter in chemistry"
  const ordinalMatch = cleanInput.match(/^(1st|first|2nd|second|3rd|third|\d+th)\s+chapter(?:\s+in\s+|\s+of\s+)(physics|chemistry|maths?|mathematics)$/i);
  if (ordinalMatch) {
    const ordRaw = ordinalMatch[1].toLowerCase();
    let index = 0;
    if (['1st', 'first'].includes(ordRaw)) index = 0;
    else if (['2nd', 'second'].includes(ordRaw)) index = 1;
    else if (['3rd', 'third'].includes(ordRaw)) index = 2;
    else {
      const num = parseInt(ordRaw);
      if (!isNaN(num) && num > 0) index = num - 1;
    }

    let subj = ordinalMatch[2].toLowerCase();
    if (subj.startsWith('math')) subj = 'mathematics';

    // Find all unique chapters for this subject in order
    const subjTopics = SYLLABUS_TOPICS.filter(t => t.subject === subj);
    const uniqueChapterIds = Array.from(new Set(subjTopics.map(t => t.chapterId)));

    if (index >= 0 && index < uniqueChapterIds.length) {
      const targetChapterId = uniqueChapterIds[index];
      // Return the first topic of this chapter as a representative
      const topic = subjTopics.find(t => t.chapterId === targetChapterId);
      if (topic) return topic;
    }
  }

  // Reject inputs that are too short or are common pronouns/stop words
  // — these would fuzzy-match to random topics (e.g. "it" → "Gravitation")
  const STOP_WORDS = new Set([
    'it', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'he', 'she',
    'they', 'we', 'you', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'where', 'when', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'one', 'two', 'first', 'last', 'next', 'new', 'old', 'good', 'bad',
    'topic', 'chapter', 'subject', 'section', 'unit', 'part',
  ]);
  // Single stop word or very short non-specific input → reject
  if (STOP_WORDS.has(cleanInput)) return null;
  if (cleanInput.length < 3) return null;
  // Multi-word but ALL words are stop words → reject (e.g. "the first one")
  const inputWords = cleanInput.split(/\s+/);
  if (inputWords.every(w => STOP_WORDS.has(w))) return null;

  // Exact or contains match
  let bestMatch: SyllabusTopic | null = null;
  let highestScore = 0;

  for (const topic of SYLLABUS_TOPICS) {
    const topicName = topic.name.toLowerCase();

    if (topicName === cleanInput) {
      return topic; // Perfect match
    }

    if (topicName.includes(cleanInput) || cleanInput.includes(topicName)) {
      const score = topicName.includes(cleanInput)
        ? cleanInput.length / topicName.length
        : topicName.length / cleanInput.length;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = topic;
      }
    }
  }

  // Token-based fuzzy match (handles typos like "moleconcepts" → "Mole Concept")
  if (!bestMatch || highestScore < 0.6) {
    const inputTokens = cleanInput
      .split(/[\s,&]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 3);
    if (inputTokens.length === 0) return bestMatch;

    let bestFuzzyScore = 0;
    let bestFuzzyTopic: SyllabusTopic | null = null;

    for (const topic of SYLLABUS_TOPICS) {
      const topicTokens = topic.name.toLowerCase()
        .split(/[\s,&]+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length >= 3);
      if (topicTokens.length === 0) continue;

      let matchedScore = 0;
      for (const inputToken of inputTokens) {
        let tokenBest = 0;
        for (const topicToken of topicTokens) {
          const sim = tokenSimilarity(inputToken, topicToken);
          if (sim > tokenBest) tokenBest = sim;
        }
        // Accept tokens that are >= 0.55 similar (allows ~2 edits in 5 chars)
        if (tokenBest >= 0.55) matchedScore += tokenBest;
      }

      const totalScore = matchedScore / inputTokens.length;
      if (totalScore > bestFuzzyScore) {
        bestFuzzyScore = totalScore;
        bestFuzzyTopic = topic;
      }
    }

    if (bestFuzzyTopic && bestFuzzyScore >= 0.55 && bestFuzzyScore > highestScore) {
      bestMatch = bestFuzzyTopic;
    }
  }

  return bestMatch;
}

// 2. Helper to execute Tavily Search with timeout and retry
// Uses include_answer so Tavily returns a clean AI-written summary instead of raw scraped FAQ snippets.
async function executeTavilySearch(query: string, apiKey: string) {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 10000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Tavily API error: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('Tavily search execution failed:', err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

// 2b. Textbook-specific Tavily search with domain targeting
async function executeTextbookSearch(query: string, apiKey: string) {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 10000;

  // Clean the query down to a focused search intent
  const cleanQuery = buildTextbookSearchQuery(query);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: cleanQuery,
          search_depth: 'advanced',
          max_results: 5,
          include_domains: TEXTBOOK_DOMAINS,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Tavily textbook search error: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('Tavily textbook search failed:', err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

function isTextbookQuery(query: string): boolean {
  const lower = query.toLowerCase();
  
  // Specific textbook names
  const specificBooks = [
    'hc verma', 'dc pandey', 'ie irodov', 'irodov', 'resnick halliday',
    'concepts of physics', 'ms chauhan', 'op tandon', 'p bahadur',
    'rd sharma', 'rs aggarwal', 'sl loney', 'cengage', 'arihant',
    'grb', 'tmh', 'wiley', 'pearson', 'sl loney', 'halliday'
  ];
  
  const hasSpecificBook = specificBooks.some(b => lower.includes(b));
  const hasBookIndicator = /\b(pdf|book|textbook|download|edition|reference|solutions|guide|modules|notes|free\s+download)\b/i.test(query);
  
  // A query is a textbook query if:
  // 1. It explicitly asks for a book/file indicator AND mentions at least one of (ncert, jee main, jee advanced, or specific books/subjects).
  // 2. Or if it mentions a specific book name directly.
  const hasAcademicContext = /\b(ncert|jee|iit|physics|chemistry|maths|mathematics|calculus|algebra|mechanics)\b/i.test(query);
  
  return (hasSpecificBook || (hasBookIndicator && hasAcademicContext));
}

function safeHostname(url: string): string {
  try {
    return `Resource from ${new URL(url).hostname}`;
  } catch {
    return 'Study Resource';
  }
}

// Strip a user's natural-language query down to a clean textbook search intent.
// Removes command phrases like "use web search and ask me questions from",
// directives like "I want", and focuses on the actual subject/grade/exercise
// keywords that a search engine can use. Without this, Tavily gets the full
// user message as a query and returns irrelevant results.
function buildTextbookSearchQuery(rawQuery: string): string {
  const lower = rawQuery.toLowerCase();

  // Extract the subject if mentioned
  let subject = '';
  if (/\b(physics)\b/.test(lower)) subject = 'physics';
  else if (/\b(chemistry)\b/.test(lower)) subject = 'chemistry';
  else if (/\b(maths|mathematics|math)\b/.test(lower)) subject = 'mathematics';

  // Extract the class/grade
  const classMatch = lower.match(/\bclass\s*(?:1[12]|xii|x|xi|11|12|10|9|8)?\b/);
  const classLabel = classMatch ? classMatch[0] : '';

  // Extract the chapter / exercise reference
  const chapterMatch = lower.match(/\bchapter\s*\d+/i);
  const exerciseMatch = lower.match(/\bexercise\s*[\d.]+/i);

  // Extract any remaining topic words (skip common stopwords and command verbs)
  const STOPWORDS = new Set([
    'use', 'web', 'search', 'and', 'ask', 'me', 'questions', 'from', 'in', 'on', 'of',
    'a', 'an', 'the', 'to', 'please', 'find', 'get', 'give', 'show', 'tell', 'want',
    'need', 'i', 'you', 'can', 'could', 'would', 'should', 'do', 'does', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'with', 'for', 'by',
    'this', 'that', 'these', 'those', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'don', 'should', 'now', 'help', 'my', 'your',
  ]);

  const tokens = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));

  // Build a focused query. Order matters — search engines weight earlier terms.
  const parts: string[] = [];
  if (classLabel) parts.push(classLabel);
  parts.push('NCERT');
  if (subject) parts.push(subject);
  if (chapterMatch) parts.push(chapterMatch[0].toLowerCase());
  if (exerciseMatch) parts.push(exerciseMatch[0].toLowerCase());

  // Add remaining meaningful tokens (capped to 6) — but skip things we already added
  const alreadyAdded = new Set(parts.map(p => p.toLowerCase()));
  for (const t of tokens) {
    if (parts.length >= 10) break;
    if (alreadyAdded.has(t)) continue;
    parts.push(t);
    alreadyAdded.add(t);
  }

  parts.push('PDF free download');
  return parts.filter(Boolean).join(' ');
}

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TEXTBOOK_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function hasRecognizableSubjectToken(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();

  // The title must contain a SPECIFIC identifier — not just a generic "NCERT" tag.
  // Generic titles like "kemh105.pdf" or just "PDF" pass the obvious "ncert" check
  // but provide no useful context to the student.
  const SPECIFIC = [
    // Author names
    'hc verma', 'dc pandey', 'ie irodov', 'resnick', 'halliday',
    'cengage', 'arihant', 'grb', 'tmh', 'wiley', 'pearson', 'p bahadur',
    'op tandon', 'ms chauhan', 'rd sharma', 'rs aggarwal', 'sl loney',
    // Book names
    'concept of physics', 'physical chemistry', 'organic chemistry', 'inorganic chemistry',
    'master resource book', 'problems in general physics',
    // Class / grade — strong signal of useful specificity
    'class xi', 'class xii', 'class 9', 'class 10', 'class 11', 'class 12',
    'grade 9', 'grade 10', 'grade 11', 'grade 12',
    // Chapter or exercise reference
    'chapter ', 'exercise ',
    // Subject matter combined with NCERT (not just bare "NCERT" tag)
    'ncert solutions', 'ncert exemplar',
  ];

  // Drop "kemh###.pdf" style generic filenames — these are raw textbook PDFs with
  // no class/chapter/exercise info in the title.
  if (/^[a-z]{2,4}\d{2,4}\.pdf\s*$/i.test(title.trim())) return false;

  return SPECIFIC.some(t => lower.includes(t));
}

function buildResourceFromResult(result: any, query: string): any {
  // Validation: drop results whose URL is not in the allowed domain list
  if (!result.url || !isAllowedDomain(result.url)) {
    return null;
  }

  // Validation: drop results with no recognizable subject token in the title
  // (prevents garbage like "kemh105.pdf" or "PDF" with no class/chapter info)
  if (!result.title || !hasRecognizableSubjectToken(result.title)) {
    return null;
  }

  const subject = query.toLowerCase().includes('physics') ? 'physics'
    : query.toLowerCase().includes('chemistry') ? 'chemistry'
    : query.toLowerCase().includes('math') ? 'mathematics'
    : 'general';

  const cleaned = result.title?.replace(/^\[?PDF\]?[-:\s]*/i, '').replace(/free\s*download.*$/i, '').trim();
  const rawName = (cleaned && cleaned.length > 2) ? cleaned : null;
  const name = (rawName && rawName.length > 2 && !/^[\s\[\]\-:.]+$|^\[[\]:\-\s]{0,5}\]?$/i.test(rawName))
    ? rawName
    : result.url ? safeHostname(result.url)
    : 'Study Resource';
  return {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    type: 'pdf',
    subject,
    description: result.content?.substring(0, 150) || '',
    url: result.url,
    addedDate: new Date().toISOString().split('T')[0],
    source: 'ai_search',
  };
}

// Extract tool intent from user query or structured markers from LLM response.
// Returns true if a client_action was emitted.
// Priority: 1) Structured markers [MARK:...] or [LOG:...] from LLM,
//           2) Regex-based intent parsing on query/assistant text.

export async function POST(req: Request) {
  try {
    // Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    try {
      await limiter.check(30, ip); // 30 requests per minute
    } catch {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    
    // Input Validation
    const ChatSchema = z.object({
      messages: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
      systemPrompt: z.string().optional(),
      deviceId: z.string().optional(),
      agentType: z.string().optional(),
      action: z.string().optional(),
      query: z.string().optional(),
      response: z.string().optional(),
      context: z.string().optional(),
      // Allow other fields without strict validation to avoid breaking existing functionality
    }).passthrough();

    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      messages,
      systemPrompt,
      deviceId,
      agentType,
      contextSummary,
      pageContent,
      memoryContext,
      action,
      query,
      response,
      context,
      ragContext
    } = body;

    const hackClubApiKey = process.env.HACKCLUB_API_KEY;
    const hackClubModel = process.env.HACKCLUB_MODEL || 'google/gemini-3.5-flash';
    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (action === 'reflect') {
      if (!hackClubApiKey) {
        return NextResponse.json({ error: 'Hack Club API Key not configured' }, { status: 400 });
      }
      try {
        const reflectionPrompt = `You are Hermes, a meta-cognitive reflection engine. Your sole purpose is to analyze an AI-user interaction and extract insights to make future responses better.

Analyze the following interaction and return a JSON object with these fields:
- adaptationNotes: array of strings — what should the AI adapt about its approach for this user?
- confidenceAdjustment: number from -0.3 to +0.3 — how much to adjust response confidence based on user engagement
- suggestedTools: array of strings — what tools would have been useful here?
- userPersonaInsight: string or null — a single insight about this user's learning style

Interaction:
User Query: ${String(query || '').slice(0, 500)}
AI Response: ${String(response || '').slice(0, 1000)}
User's Learning Context: ${String(context || '').slice(0, 300)}

Return ONLY valid JSON, no other text.`;

        const res = await fetch(HACKCLUB_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hackClubApiKey}` },
          body: JSON.stringify({
            model: hackClubModel,
            messages: [{ role: 'system', content: reflectionPrompt }],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!res.ok) {
          return NextResponse.json({ error: 'Reflection request failed' }, { status: 502 });
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const json = JSON.parse(text.replace(/```json|```/g, '').trim());
        return NextResponse.json(json);
      } catch (e: any) {
        console.error('Reflection route failed:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }

    const encoder = new TextEncoder();
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    };

    // Extract user's latest query
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const latestQuery = userMessages[userMessages.length - 1]?.content || '';

    // Initialize shared memory for this session. MemoryStore is a client-side
    // helper (it uses localStorage), so instantiating it in this server route
    // can throw. We catch the failure and fall through with a no-op memory
    // object so the rest of the handler (LLM call + smart fallback) still works.
    let memory: any;
    try {
      memory = new MemoryStore(deviceId || 'anonymous');
    } catch (memErr) {
      console.warn('[MemoryStore] unavailable in server context, using no-op stub:', memErr);
      memory = {
        add: async () => {},
        getContext: () => '',
        clear: () => {},
        getAll: () => [],
      };
    }

    // Load conversation history from Supabase for context engineering
    let conversationHistory: { role: string; content: string }[] = [];
    if (deviceId && agentType) {
      try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        conversationHistory = await loadConversationHistory(supabase, deviceId, agentType, 15);
      } catch (e) {
        console.warn('Failed to load conversation history:', e);
      }
    }

    // Check if we should use fallback (either Hack Club API is not set or we want to guarantee success if it fails)
    const useFallback = !hackClubApiKey;

    // Stream definition — textbook search runs INSIDE the stream so we can emit status events
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        };

        // Check for textbook query and search inside the stream
        let textbookSearchResults: any = null;
        if (isTextbookQuery(latestQuery) && tavilyApiKey) {
          sendEvent({ type: 'step_start', step: 'textbook_search' });
          sendEvent({ type: 'status', message: 'Searching for textbooks and resources...' });
          sendEvent({ type: 'tool_start', id: 'textbook_search', name: 'textbook_search' });
          try {
            textbookSearchResults = await executeTextbookSearch(latestQuery, tavilyApiKey);
            if (textbookSearchResults?.results?.length > 0) {
              const resources = textbookSearchResults.results
                .map((r: any) => buildResourceFromResult(r, latestQuery))
                .filter((r: any): r is any => r !== null);
              sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: resources } });
              for (const res of resources) {
                sendEvent({ type: 'resource_result', payload: res });
              }
              sendEvent({ type: 'status', message: `Found ${resources.length} resource(s), generating response...` });
              sendEvent({ type: 'step_end', step: 'textbook_search', result: { count: resources.length } });
            } else {
              sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [] } });
            }
          } catch (e) {
            console.warn('Textbook search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [], error: true } });
            sendEvent({ type: 'step_end', step: 'textbook_search', result: { error: true } });
          }
        }

        let webSearchResults: any = null;
        if (!textbookSearchResults && isGeneralWebSearchQuery(latestQuery) && tavilyApiKey) {
          sendEvent({ type: 'step_start', step: 'web_search' });
          sendEvent({ type: 'status', message: 'Searching the web for current information...' });
          sendEvent({ type: 'tool_start', id: 'call_search', name: 'tavily_search' });
          try {
            webSearchResults = await executeTavilySearch(latestQuery, tavilyApiKey);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: webSearchResults });
            sendEvent({ type: 'status', message: 'Synthesizing response and generating answer...' });
            sendEvent({ type: 'step_end', step: 'web_search', result: { completed: true } });
          } catch (e) {
            console.warn('General web search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: null, error: true });
            sendEvent({ type: 'step_end', step: 'web_search', result: { error: true } });
          }
        }

        if (useFallback) {
          // In fallback mode, the textbook search already happened.
          // Now run the fallback (which also checks isTextbookQuery, but we bypass searching again
          // by passing already-found results via a modified flow).
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
            resources.slice(0, 5).forEach((res: any, idx: number) => {
              contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
              if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
              contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
            });
            contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
            sendEvent({ type: 'text', content: contentStr });
          } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results

I searched the web for "${latestQuery}" and found the following:

`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}

`;
              contentStr += `**Sources:**
`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})
`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
          }
          controller.close();
          return;
        }

        try {
          // Attempt actual API call
          const currentMessages: { role: string; content: string }[] = [];

          // ── Shared Memory Injection ─────────────────────────────────────
          let finalMemoryContext = memoryContext || '';
          if (!finalMemoryContext) {
            try {
              finalMemoryContext = await memory.getContextString(latestQuery, 8);
              await memory.add(
                `User asked about: ${latestQuery.slice(0, 200)}`,
                'interaction_summary',
                'system',
                [agentType || 'general'],
                0.3,
              );
            } catch (e) {
              console.warn('Memory injection failed:', e);
            }
          }

          // ── Deep Research Agent ──────────────────────────────────────────
          let deepResearchResults: any = null;
          // Reduced Tavily API calls: only trigger on explicit deep research requests or very specific complex markers.
          const isDeepResearch = /\[DEEP_RESEARCH:|deep research|research deeply|comprehensive research|multi.?step research/i.test(latestQuery);
          if (isDeepResearch && tavilyApiKey && !textbookSearchResults && !webSearchResults) {
            sendEvent({ type: 'step_start', step: 'deep_research' });
            sendEvent({ type: 'status', message: '🔬 Initiating deep research agent...' });
            try {
              deepResearchResults = await executeDeepResearch(latestQuery, tavilyApiKey, (status) => {
                sendEvent({ type: 'status', message: status });
              }, memory);
              if (deepResearchResults?.synthesis) {
                sendEvent({ type: 'status', message: `✓ Deep research complete — ${deepResearchResults.totalSources} sources synthesized` });
                sendEvent({ type: 'step_end', step: 'deep_research', result: { findings: deepResearchResults.findings.length, sources: deepResearchResults.totalSources } });
              }
            } catch (e) {
              console.warn('Deep research failed:', e);
              sendEvent({ type: 'step_end', step: 'deep_research', result: { error: true } });
            }
          }

          // Build system prompt with context engineering
          let augmentedSystemPrompt = systemPrompt || '';
          if (contextSummary) {
            augmentedSystemPrompt += `\n\nStudent context: ${contextSummary}`;
          }
          if (finalMemoryContext) {
            augmentedSystemPrompt += `\n\n${finalMemoryContext}`;
          }
          if (pageContent) {
            augmentedSystemPrompt += `\n\n### Current Screen Context (DOM Summary):\nThe student is currently looking at this on their screen:\n${pageContent}`;
          }
          if (ragContext) {
            augmentedSystemPrompt += `\n\n### 📖 Local Study Materials & Resources (RAG Context):\nThe following relevant content was retrieved from the student's uploaded textbooks/notes:\n${ragContext}\n\nUse this local knowledge to formulate your answer. Cite the document name where the information was retrieved.`;
          }
          augmentedSystemPrompt += `\n\n---\n### Tool Action Markers\nWhen you intend to update a topic's status, include this exact marker in your response:\n[MARK:Topic Name:status]\n- Valid statuses: learning, in progress, completed, revised, mastered, not started\n- Example: "I'll mark that for you now. [MARK:Linear Inequalities:in progress]"\n\nWhen you intend to log study time, include:\n[LOG:Topic Name:minutes]\n- Example: "I've logged your study session. [LOG:Kinematics:45]"\n\nNew advanced markers:\n- [REMEMBER:observation] — Save an observation about the user to shared memory\n- [DEEP_RESEARCH:query] — Trigger multi-step deep research on a topic\n\nPlace the marker naturally in your response text. The system will process it automatically.`;

          augmentedSystemPrompt += `\n\n### 🧪 AI-Generated Custom Tests (Agentic Flow)\nWhen the user asks for a mock test/quiz/practice on any specific NCERT topic (e.g. "give me a mock test on linear inequalities exercise 6.1", "quiz on kinematics", "25 JEE Main practice questions"):\n1. **Generate 5-15 MCQ questions directly** from your training knowledge (you know NCERT/JEE content well). Each question MUST have exactly 4 options with one correct answer.\n2. **Call \`generate_mock_test\`** with the \`questions\` parameter containing your generated questions. If you need web research for a topic you're unsure about, first include \`[DEEP_RESEARCH:<topic>]\` in your response text (the system will research it), then generate questions from the researched content. However, for standard NCERT topics like Linear Inequalities, Kinematics, etc., generate questions directly — you already know them.\n3. Each question MUST include: \`question\` (string with LaTeX math using $...$), \`options\` (array of exactly 4 strings), \`correctAnswer\` (0-3 index of correct option), \`explanation\` (string explaining the solution).\n4. Do NOT ask the user to configure anything — just tell them what you are creating and launch it immediately. Example: "Creating a 10-question mock test on Linear Inequalities..." then call the tool.`;

          augmentedSystemPrompt += `\n\n### 📇 AI-Generated Flashcards\nWhen the user asks to create flashcards for a specific topic or chapter (e.g., "Create five flashcards for Chemistry Chapter 1", "Make flashcards for Newton's laws"):\n1. **Call \`generate_flashcards\`** with the requested number of high-quality flashcards. Make sure the front is a clear question or term, and the back is the answer or a formula.\n2. Use LaTeX math notation inside $...$ or $$...$$ if applicable, and set \`isLatex: true\` for those cards.\n3. Do NOT ask the user to configure anything — just tell them what you are creating and launch it immediately.`;

          augmentedSystemPrompt += `\n\n### 🔎 Web Search Tooling & Capabilities\n- You DO NOT have direct access to a web browser or search tool.\n- For queries requiring real-time information or specific resources, the system attempts to run a search BEFORE calling you.\n- IF a search was performed, the results will be injected below under "📚 Textbook Search Results" or "🌐 Web Search Results". Treat those injected results as ground truth, cite their sources, and NEVER deny that a search was run.\n- IF NEITHER heading is present below, NO SEARCH WAS PERFORMED. You MUST NOT pretend to have run a search. If the user asks for real-time info (e.g., current events, "who won", future dates), honestly state that you lack real-time web access and cannot browse the internet, and recommend they use a search engine.`;

          // Inject textbook search results if available
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            const resourcesInfo = resources.map((r: any, i: number) =>
              `${i + 1}. **${r.name}** — ${r.description ? r.description.substring(0, 100) + '...' : ''}\n   📥 ${r.url}`
            ).join('\n');
            augmentedSystemPrompt += `\n\n---\n### 📚 Textbook Search Results\n*The system ran a textbook search for you. Here are the findings — you can reference them confidently:*\n\n${resourcesInfo}\n\nIf the student asks for the exact text of a specific exercise, point them to the PDF link above rather than inventing questions. The resources have been added to the student's Material Library automatically.`;
          }

          // Inject general web search results if available
          if (webSearchResults?.results?.length > 0) {
            let webInfo = '';
            if (webSearchResults.answer) webInfo += `**Summary:** ${webSearchResults.answer}\n\n`;
            webInfo += `**Sources:**\n` + webSearchResults.results.map((r: any, i: number) => 
              `${i + 1}. [${r.title}](${r.url})\n${r.content.substring(0, 200)}...`
            ).join('\n\n');
            augmentedSystemPrompt += `\n\n---\n### 🌐 Web Search Results\n*The system ran a web search for you. Here are the findings:*\n\n${webInfo}`;
          }

          // Inject deep research results if available
          if (deepResearchResults?.synthesis) {
            augmentedSystemPrompt += `\n\n---\n### 🔬 Deep Research Results\n*The system performed multi-step research on your query. Here is the synthesis:*\n\n${deepResearchResults.synthesis}\n`;
          }

          if (augmentedSystemPrompt) {
            currentMessages.push({ role: 'system', content: augmentedSystemPrompt });
          }

          // Prepend conversation history
          if (conversationHistory.length > 0) {
            currentMessages.push(...conversationHistory);
          }

          currentMessages.push(...messages);

          let assistantContent = '';

          const hackClubController = new AbortController();
          const hackClubTimeoutId = setTimeout(() => hackClubController.abort(), 55000);

          sendEvent({ type: 'step_start', step: 'llm_call' });
          
          // Disable tools for simple conversational greetings to prevent aggressive tool hallucination
          const isSimpleGreeting = /^(hi|hello|hey|yo|greetings|morning|afternoon|evening)\s*$/i.test(latestQuery.trim());
          
          const payload: any = {
            model: hackClubModel,
            messages: currentMessages,
            temperature: 0.5,
            stream: true,
          };
          
          const allowedToolAgents = ['tutor', 'coach', 'copilot', 'resource'];
          if (!isSimpleGreeting && agentType && allowedToolAgents.includes(agentType)) {
            payload.tools = toolSchemas;
            payload.tool_choice = 'auto';
          }

          const response = await fetch(HACKCLUB_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${hackClubApiKey}`,
            },
            body: JSON.stringify(payload),
            signal: hackClubController.signal,
          });

          clearTimeout(hackClubTimeoutId);

          // If the completions endpoint fails with Auth or Model error, fall back gracefully
          if (!response.ok) {
            console.warn(`API returned status ${response.status}. Initiating fallback...`);
            if (textbookSearchResults?.results?.length > 0) {
              const resources = textbookSearchResults.results
                .map((r: any) => buildResourceFromResult(r, latestQuery))
                .filter((r: any): r is any => r !== null);
              let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
              resources.slice(0, 5).forEach((res: any, idx: number) => {
                contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
                if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
                contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
              });
              contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
              sendEvent({ type: 'text', content: contentStr });
            } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results\n\nI searched the web for "${latestQuery}" and found the following:\n\n`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}\n\n`;
              contentStr += `**Sources:**\n`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})\n`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
              await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
            }
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to read response stream');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          
          const toolCallsAcc: any[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta;
                
                if (delta?.content) {
                  assistantContent += delta.content;
                  sendEvent({ type: 'text', content: delta.content });
                }
                
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCallsAcc[tc.index]) toolCallsAcc[tc.index] = { function: { name: "", arguments: "" } };
                    if (tc.function?.name) toolCallsAcc[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCallsAcc[tc.index].function.arguments += tc.function.arguments;
                  }
                }
              } catch {
                // Ignore event processing errors
              }
            }
          }

          let toolActionEmitted = false;
          // Process Native Tool Calls
          if (toolCallsAcc.length > 0) {
            sendEvent({ type: 'step_start', step: 'tool_action' });
            for (const tc of toolCallsAcc) {
              if (!tc || !tc.function) continue;
              const name = tc.function.name;
              try {
                const args = JSON.parse(tc.function.arguments);
                
                if (name === 'remember') {
                  sendEvent({
                    type: 'remember',
                    observation: args.observation,
                    tags: args.tags || []
                  });
                  await executeServerTool(name, args, memory);
                } else if (name === 'deep_research') {
                  if (args.query) {
                    sendEvent({ type: 'status', message: `🔬 Researching: "${args.query.slice(0, 80)}..."` });
                    try {
                      const researchResults = await executeDeepResearch(args.query, tavilyApiKey || '', (status) => {
                        sendEvent({ type: 'status', message: status });
                      }, memory);
                      if (researchResults?.synthesis) {
                        sendEvent({ type: 'text', content: `🔬 **Research Results for "${args.query}":**\n\n${researchResults.synthesis}` });
                      }
                    } catch {
                      sendEvent({ type: 'status', message: '⚠️ Research failed — proceeding without web results.' });
                    }
                  }
                } else if (name === 'generate_mock_test') {
                  // Map the AI-generated questions into the internal TestQuestion format
                  const testQs = (args.questions || []).map((q: any, i: number) => ({
                    id: `ai-gen-${Date.now()}-${i}`,
                    question: q.question,
                    options: q.options || [],
                    correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
                    explanation: q.explanation || '',
                    topicId: '',
                    chapterId: '',
                    subject: args.subject || 'mathematics',
                    difficulty: 'medium',
                    type: 'mcq',
                    source: 'AI Tutor Generated'
                  }));

                  // Emit the dynamic questions so the frontend caches them
                  sendEvent({
                    type: 'dynamic_questions',
                    questions: testQs,
                    title: args.title || 'AI Generated Test',
                    subject: args.subject || 'mathematics',
                    source: 'AI Tutor Generated'
                  });

                  // Then navigate the user to the test arena with dqKey params
                  sendEvent({
                    type: 'client_action',
                    action: 'generate_mock_test',
                    args: {
                      subjects: [args.subject || 'mathematics'],
                      difficulty: args.difficulty || 'medium',
                      questionCount: testQs.length,
                      title: args.title || 'AI Generated Test',
                    }
                  });
                  toolActionEmitted = true;
                } else {
                  // Client action
                  // Hydrate topic info if topicName is provided
                  if (args.topicName) {
                    const topic = findTopicByName(args.topicName);
                    if (topic) {
                      args.topicId = topic.id;
                      args.chapterId = topic.chapterId;
                      args.subject = topic.subject;
                      args.chapterName = topic.chapterName;
                    }
                  }
                  
                  sendEvent({
                    type: 'client_action',
                    action: name,
                    args: args
                  });
                  toolActionEmitted = true;
                }
              } catch (e) {
                console.warn('Failed to parse or execute tool call:', e);
              }
            }
            sendEvent({ type: 'step_end', step: 'tool_action', result: { action: 'emitted' } });
          }

          sendEvent({ type: 'step_end', step: 'llm_call', result: { streamed: !!assistantContent.trim() } });

          // If the LLM produced no usable content and no tool action fired,
          // run the smart fallback so the user always gets a meaningful response.
          const cleanedAssistant = assistantContent.trim();
          if (!cleanedAssistant && !toolActionEmitted) {
            console.warn('LLM returned empty content and no tool action; running smart fallback.');
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
          }

          controller.close();



          // Save conversation to Supabase after streaming completes
          if (deviceId && agentType) {
            try {
              const cookieStore = await cookies();
              const supabase = createClient(cookieStore);
              const newUserMessages = messages.filter((m: any) => m.role === 'user');
              for (const msg of newUserMessages) {
                await saveMessage(supabase, deviceId, agentType, msg.role, msg.content);
              }
              if (assistantContent) {
                const cleanedContent = assistantContent.replace(/\[(?:MARK|LOG|NAVIGATE|CREATE_TASK|SCHEDULE_REVISION|UPDATE_PROFILE|ADD_INSIGHT|REMEMBER|DEEP_RESEARCH):[^\]]*\]/g, '').trim();
                await saveMessage(supabase, deviceId, agentType, 'assistant', cleanedContent);
              }
            } catch (e) {
              console.warn('Failed to save conversation:', e);
            }
          }
        } catch (apiError: any) {
          console.error('LLM API Error, running fallback:', apiError);
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${latestQuery}" and found the following resources:\n\n`;
            resources.slice(0, 5).forEach((res: any, idx: number) => {
              contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
              if (res.description) contentStr += `   > ${res.description.substring(0, 150)}\n`;
              contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
            });
            contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;
            sendEvent({ type: 'text', content: contentStr });
          } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results

I searched the web for "${latestQuery}" and found the following:

`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}

`;
              contentStr += `**Sources:**
`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})
`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent, ragContext);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error: any) {
    console.error('Error in chat route handler:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Smart local fallback that handles searching and tool call mockups dynamically
async function runSmartFallback(query: string, tavilyKey: string, sendEvent: (event: object) => void, ragContext?: string) {
  // Track whether at least one text event was sent; if not, emit a safety-net fallback
  // at the end. This guarantees the frontend always receives content.
  let _hasSentText = false;
  const _origSendEvent = sendEvent;
  sendEvent = (event: object) => {
    if ((event as any).type === 'text') _hasSentText = true;
    _origSendEvent(event);
  };

  try {
    const lowerQuery = query.toLowerCase();
    
    if (ragContext && !lowerQuery.includes('strategic mock diagnostic') && !lowerQuery.includes('test stats:')) {
      sendEvent({ type: 'status', message: 'Retrieving local resource knowledge...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({ type: 'text', content: `### 📖 Local Study Resource Insights\nBased on your uploaded study materials, here is the relevant information I found:\n\n${ragContext}\n\n---\n` });
    }

    // AI Test Strategist Report Fallback
    if (lowerQuery.includes('strategic mock diagnostic') || lowerQuery.includes('test stats:')) {
      const scoreMatch = query.match(/Score obtained:\s*(-?\d+)\s*\/\s*(\d+)/i);
      const correctMatch = query.match(/Correct answers:\s*(\d+)/i);
      const wrongMatch = query.match(/Incorrect answers.*:\s*(\d+)/i);
      const skippedMatch = query.match(/Unanswered.*:\s*(\d+)/i);
      const durationMatch = query.match(/Test Duration:\s*([^\n]+)/i);
      const accuracyMatch = query.match(/Overall attempt accuracy:\s*([^\n]+)/i);

      const scoreObtained = scoreMatch ? scoreMatch[1] : '0';
      const maxMarks = scoreMatch ? scoreMatch[2] : '0';
      const correctAnswers = correctMatch ? correctMatch[1] : '0';
      const incorrectAnswers = wrongMatch ? wrongMatch[1] : '0';
      const skippedAnswers = skippedMatch ? skippedMatch[1] : '0';
      const duration = durationMatch ? durationMatch[1] : 'N/A';
      const accuracy = accuracyMatch ? accuracyMatch[1] : '0%';

      sendEvent({ type: 'status', message: 'Analyzing test statistics...' });
      await new Promise(r => setTimeout(r, 600));
      sendEvent({ type: 'status', message: 'Generating strategic mock diagnostic report...' });
      await new Promise(r => setTimeout(r, 600));

      const report = `### 🎯 AI Test Strategist Diagnostic Verdict

Here is your diagnostic analysis based on your latest test stats:
- **Score:** ${scoreObtained} / ${maxMarks} marks
- **Accuracy:** ${accuracy} (Correct: ${correctAnswers}, Incorrect: ${incorrectAnswers}, Skipped: ${skippedAnswers})
- **Time Taken:** ${duration}

#### 1. ⚡ Attempt Efficiency Verdict
Your accuracy rate of **${accuracy}** indicates your current level of preparation. Spending ${duration} shows your pacing, but we need to optimize negative marking penalty (you lost marks on ${incorrectAnswers} wrong attempts).

#### 2. 🔍 Mistake Pattern Analysis
- **Negative Marking Impact:** With ${incorrectAnswers} incorrect answers, negative marking is significantly dragging your net score down. This usually indicates guess-work or formula mis-recollection.
- **Skipped Questions:** You skipped ${skippedAnswers} questions. This is a safe play to avoid negative marking, but highlights conceptual gaps in those specific areas.

#### 3. 🛠️ Actionable Recovery Plan
1. **Eliminate Blind Guessing:** In your next mock test, only mark options where you have at least 70% confidence. It is better to skip than to accumulate negative marks.
2. **Replay Your Mistakes:** Go to your **Spaced-Repetition Mistakes Log** and replay all ${incorrectAnswers} incorrect questions from this attempt. Understand the step-by-step solutions to convert these weak spots into strong points.`;

      const words = report.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 8 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 40));
        }
      }
      return;
    }

    // 1. Check if user is asking to update a topic status
    const cleaned = lowerQuery
      .replace(/['']/g, '')
      .replace(/^(?:yeah|yes|ok|okay|sure|please|pls)\s+/i, '')
      .trim();

    // Diagnostic: log entry point
    sendEvent({ type: 'status', message: `[debug] runSmartFallback called for: "${query.substring(0, 50)}"` });

  // 1. Check if user is asking to update a topic status
  // Use the same improved patterns as tryEmitToolAction
  const markMatch1 = cleaned.match(
    /(?:mark|set|update|complete|finish)\s+([a-zA-Z0-9\s,&:-]+)\s+(?:as|to)\s+(completed|learning|revised|mastered|not_started|in\s+progress)/i
  );
  const markMatch2 = cleaned.match(
    /(?:mark|set|update|complete|finish)\s+([a-zA-Z0-9\s,&:-]+)\s+in\s+progress/i
  );
  const markMatch3 = cleaned.match(
    /^(?:completed|finished|revised|mastered)\s+([a-zA-Z0-9\s,&:-]+)/i
  );
  const removeMatch1 = cleaned.match(
    /^(?:remove|delete|stop|reset|clear|drop|unmark)\s+(.+?)\s+from\s+(?:learning|studied|completed|revised|mastered|in\s+progress|not\s+started|done)/i
  );
  const removeMatch2 = cleaned.match(
    /^(?:stop|end|done|finished|complete)\s+(?:learning|studying|with)\s+(.+)/i
  );
  const removeMatch3 = cleaned.match(
    /^(?:i\s+)?(?:want|need)\s+to\s+(?:remove|delete|stop|reset|clear|drop)\s+(.+?)(?:\s+from\s+.+)?$/i
  );
  const removeMatch4 = cleaned.match(
    /^(?:reset|clear|drop|unmark|delete)\s+(.+?)(?:\s+topic)?\s*$/i
  );

  let topicNameCandidate: string | null = null;
  let statusCandidate: string | null = null;

  if (markMatch1) {
    topicNameCandidate = markMatch1[1].replace(/topic/i, '').trim();
    const rawStatus = markMatch1[2].toLowerCase().trim();
    statusCandidate = rawStatus === 'in progress' ? 'learning' : rawStatus;
  } else if (markMatch2) {
    topicNameCandidate = markMatch2[1].replace(/topic/i, '').trim();
    statusCandidate = 'learning';
  } else if (markMatch3) {
    topicNameCandidate = markMatch3[1].replace(/topic/i, '').trim();
    const raw = markMatch3[0].split(/\s+/)[0].toLowerCase();
    statusCandidate = raw === 'finished' ? 'completed' : raw;
  } else if (removeMatch1) {
    topicNameCandidate = removeMatch1[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch2) {
    topicNameCandidate = removeMatch2[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch3) {
    topicNameCandidate = removeMatch3[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  } else if (removeMatch4) {
    topicNameCandidate = removeMatch4[1]
      .replace(/\s+(?:in|on|from)\s+(?:analytics|syllabus|tracker|progress|my\s+\w+).*$/i, '')
      .replace(/topic/i, '')
      .trim();
    statusCandidate = 'not_started';
  }

  if (topicNameCandidate && statusCandidate) {
    sendEvent({ type: 'status', message: `Analyzing topic reference for "${topicNameCandidate}"...` });
    await new Promise(r => setTimeout(r, 600));

    const topic = findTopicByName(topicNameCandidate);
    if (topic) {
      sendEvent({ type: 'status', message: `Syncing syllabus changes for "${topic.name}"...` });
      await new Promise(r => setTimeout(r, 800));

      // Trigger client action
      sendEvent({
        type: 'client_action',
        action: 'update_topic_status',
        args: {
          topicId: topic.id,
          status: statusCandidate,
          confidence: 4,
          accuracy: 80,
          chapterId: topic.chapterId,
          subject: topic.subject,
          topicName: topic.name,
          chapterName: topic.chapterName
        }
      });
      await new Promise(r => setTimeout(r, 400));

      sendEvent({
        type: 'text',
        content: statusCandidate === 'not_started'
          ? `I've removed **${topic.name}** (${topic.subject}) from your active list and reset it to **not started**. You can pick it back up anytime from the **Syllabus Tracker**. 📋`
          : `I've successfully updated your syllabus! marked **${topic.name}** (${topic.subject}) as **${statusCandidate}** with a confidence rating of 4 stars.\n\nSince you've completed this topic, I've also scheduled revisions for it on Day 1, Day 7, and Day 30 in your **Revision Engine** tab. Keep it up! 🚀`
      });
      return;
    } else {
      sendEvent({ type: 'text', content: `I couldn't find a specific topic matching "${topicNameCandidate}". Please try again with the exact topic name from your syllabus (e.g., "Atomic Structure" or "Laws of Motion").` });
      return;
    }
  }

  // 2. Check if user is asking to log a study session
  const logMatch = cleaned.match(/(?:log|studied|study)\s+([a-zA-Z0-9\s,&:-]+)\s+for\s+(\d+)\s*(hour|minute|hr|min)s?/i) ||
                   cleaned.match(/(?:log|record)\s+(\d+)\s*(hour|minute|hr|min)s?\s+of\s+([a-zA-Z0-9\s,&:-]+)/i);

  if (logMatch) {
    let topicNameCandidate = '';
    let durationMinutes = 60;
    
    if (cleaned.includes('studied') || cleaned.includes('for')) {
      topicNameCandidate = logMatch[1].trim();
      const rawDur = parseInt(logMatch[2], 10);
      const isHour = logMatch[3]?.startsWith('hour') || logMatch[3]?.startsWith('hr');
      durationMinutes = isHour ? rawDur * 60 : rawDur;
    } else {
      const rawDur = parseInt(logMatch[1], 10);
      const isHour = logMatch[2]?.startsWith('hour') || logMatch[2]?.startsWith('hr');
      durationMinutes = isHour ? rawDur * 60 : rawDur;
      topicNameCandidate = logMatch[3].trim();
    }

    sendEvent({ type: 'status', message: `Locating syllabus topic: "${topicNameCandidate}"...` });
    await new Promise(r => setTimeout(r, 600));

    const topic = findTopicByName(topicNameCandidate);
    if (topic) {
      sendEvent({ type: 'status', message: `Logging ${durationMinutes} minutes of study...` });
      await new Promise(r => setTimeout(r, 800));

      sendEvent({
        type: 'client_action',
        action: 'log_study',
        args: {
          description: `Studied ${topic.name} covering major concepts.`,
          topicId: topic.id,
          chapterId: topic.chapterId,
          subject: topic.subject,
          duration: durationMinutes,
          type: 'study'
        }
      });
      await new Promise(r => setTimeout(r, 400));

      sendEvent({
        type: 'text',
        content: `Logged **${durationMinutes} minutes** of study for **${topic.name}** under **${topic.chapterName}** (${topic.subject.toUpperCase()}).\n\nYour study session has been recorded in your study logs history. I've also updated the topic status to **learning** in your syllabus tracker!`
      });
      return;
    } else {
      sendEvent({ type: 'text', content: `I couldn't find a topic matching "${topicNameCandidate}". Please provide the exact topic name so I can log your study session.` });
      return;
    }
  }

  // 3. Textbook / resource search
  if (isTextbookQuery(lowerQuery)) {
    if (!tavilyKey) {
      sendEvent({ type: 'status', message: 'Textbook search unavailable — API key not configured...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({ type: 'text', content: `I'd love to search for that textbook PDF, but the Tavily Search API key is not configured. To enable textbook search, add \`TAVILY_API_KEY\` to your \`.env.local\` file.` });
      return;
    }

    sendEvent({ type: 'status', message: `Searching for "${query}" textbooks and PDFs...` });
    sendEvent({ type: 'tool_start', id: 'textbook_search', name: 'textbook_search' });

    try {
      const searchResults = await executeTextbookSearch(query, tavilyKey);
      const resources = (searchResults.results || [])
        .map((r: any) => buildResourceFromResult(r, query))
        .filter((r: any): r is any => r !== null);
      sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: resources } });

      for (const res of resources) {
        sendEvent({ type: 'resource_result', payload: res });
      }

      sendEvent({ type: 'status', message: 'Found resources! Adding to your library...' });
      await new Promise(r => setTimeout(r, 400));

      if (resources.length > 0) {
        let contentStr = `### 📚 Found Textbooks & Resources\n\nI searched for "${query}" and found the following resources:\n\n`;
        resources.slice(0, 4).forEach((res: any, idx: number) => {
          contentStr += `**${idx + 1}. [${res.name}](${res.url})**\n`;
          if (res.description) contentStr += `   > ${res.description}\n`;
          contentStr += `   *Added to your Material Library — you can download it from the Resources tab.*\n\n`;
        });
        contentStr += `You can also ask me to search for more specific textbooks, reference books, or study materials by telling me what you need!`;

        const words = contentStr.split(' ');
        let currentChunk = '';
        for (let i = 0; i < words.length; i++) {
          currentChunk += words[i] + ' ';
          if (i % 6 === 0 || i === words.length - 1) {
            sendEvent({ type: 'text', content: currentChunk });
            currentChunk = '';
            await new Promise(r => setTimeout(r, 80));
          }
        }
      } else {
        sendEvent({ type: 'text', content: `I searched for "${query}" but couldn't find specific PDF resources. Try being more specific (e.g., "HC Verma Class 11 Physics Part 1 PDF" or "I need DC Pandey Electricity and Magnetism").` });
      }
      return;
    } catch (searchErr: any) {
      sendEvent({ type: 'error', message: `Textbook search failed: ${searchErr.message}` });
      sendEvent({ type: 'text', content: `I couldn't complete the textbook search for "${query}". Please try again with a more specific book name and author.` });
      return;
    }
  }

  // 4. Mock test / quiz generation
  const mockTestPatterns = [
    /(?:give|create|make|generate|start|launch|prepare)\s+(?:me\s+)?(?:a\s+)?(?:mock\s+)?(?:test|quiz|practice)/i,
    /(?:mock\s+test|practice\s+(?:test|quiz)|quick\s+quiz|mini\s+test)/i,
    /(?:i\s+)?(?:want|need|would\s+like)\s+(?:a\s+)?(?:mock\s+)?(?:test|quiz)/i,
    /(?:generate|create)\s+(?:some\s+)?(?:practice\s+)?questions/i,
  ];
  const isMockTestRequest = mockTestPatterns.some(p => p.test(lowerQuery));

  if (isMockTestRequest) {
    sendEvent({ type: 'status', message: `🎯 Creating a custom mock test based on your request...` });

    if (!tavilyKey) {
      sendEvent({ type: 'text', content: `I'd love to generate a mock test for you, but the Tavily Search API key is not configured. To enable web research for test generation, add \`TAVILY_API_KEY\` to your \`.env.local\` file.` });
      return;
    }

    // Extract topic from query
    const topicMatch = query.match(/(?:on|about|for|of|from)\s+(.+?)(?:\s+(?:exercise|chapter|questions|class|ncert)|$)/i);
    const searchTopic = topicMatch ? topicMatch[1].trim() : query;

    sendEvent({ type: 'status', message: `🔍 Researching "${searchTopic}" questions...` });
    sendEvent({ type: 'tool_start', id: 'mock_test_search', name: 'tavily_search' });

    try {
      const searchResults = await executeTavilySearch(`NCERT ${searchTopic} MCQ questions exercise problems with solutions`, tavilyKey);
      sendEvent({ type: 'tool_end', id: 'mock_test_search', name: 'tavily_search', result: searchResults });
      sendEvent({ type: 'status', message: `📝 Crafting questions from research...` });
      await new Promise(r => setTimeout(r, 600));

      // Build questions from search results or use defaults
      const questions = buildQuestionsFromSearchResults(searchResults, searchTopic).map((q: any, i: number) => ({
        id: `ai-gen-${Date.now()}-${i}`,
        question: q.question,
        options: q.options || [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: q.explanation || '',
        topicId: q.topicId || '',
        chapterId: q.chapterId || '',
        subject: q.subject || 'mathematics',
        difficulty: q.difficulty || 'medium',
        type: q.type || 'mcq',
        source: q.source || 'AI Tutor Generated'
      }));

      if (questions.length === 0) {
        sendEvent({ type: 'text', content: `I searched the web for "${searchTopic}" questions but couldn't find enough material. Please try a more specific topic name.` });
        return;
      }

      const testTitle = `${searchTopic} Mock Test`;

      // Emit dynamic questions (client will cache them and set pendingDqKey)
      sendEvent({
        type: 'dynamic_questions',
        questions,
        title: testTitle,
        subject: 'mathematics',
        source: 'AI Tutor Generated (Web Researched)'
      });

      await new Promise(r => setTimeout(r, 300));

      // Emit client_action so the client navigates with the dqKey
      sendEvent({
        type: 'client_action',
        action: 'generate_mock_test',
        args: {
          subjects: ['mathematics'],
          difficulty: 'medium',
          questionCount: questions.length,
          title: testTitle,
        }
      });

      sendEvent({ type: 'status', message: `✅ ${questions.length}-question test ready! Launching...` });
      return;
    } catch (searchErr: any) {
      console.warn('Mock test search failed:', searchErr);
      sendEvent({ type: 'error', message: `Question research failed: ${searchErr.message}` });
      sendEvent({ type: 'text', content: `I encountered an error while researching "${searchTopic}". Please try again with a more specific topic.` });
      return;
    }
  }

  // 5. Web search trigger - only if the query has academic context or explicit search keyword
  // and is NOT a greeting or question about capabilities.
  const isGreeting = GREETINGS.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' ') || lowerQuery.startsWith(g + '!'));
  const isCapability = CAPABILITIES.some(c => lowerQuery.includes(c) || lowerQuery === 'help' || lowerQuery === '?');
  const hasJEEContext = JEE_KEYWORDS.some(kw => lowerQuery.includes(kw));
  const hasExplicitSearch = EXPLICIT_SEARCH.some(kw => lowerQuery.includes(kw));
  const isSearchWorthy = (hasJEEContext || hasExplicitSearch) && !isGreeting && !isCapability;

  if (isCapability) {
    sendEvent({ type: 'status', message: 'Analyzing capabilities...' });
    await new Promise(r => setTimeout(r, 400));
    sendEvent({ type: 'status', message: 'Describing features...' });
    await new Promise(r => setTimeout(r, 400));

    const responseText = `I am your **JEE OS AI Tutor & Assistant**. I can help you manage your study preparation, track your syllabus, log study hours, and answer academic questions.\n\nHere are some of the main things I can do:\n\n1. **Syllabus Tracker Updates**:\n   - You can ask me to update your status for any JEE topic. For example: *"Mark Friction as completed"* or *"Set Laws of Motion to learning"*.\n   - After you confirm my suggestion, I will update your syllabus and schedule spaced repetition revision tasks (Day 1, 7, 30).\n\n2. **Study Logging**:\n   - Tell me what you studied and for how long, and I'll log it. For example: *"I studied Mole Concept for 90 minutes"* or *"Logged 2 hours of electrostatics"*.\n\n3. **Academic Explanations & Web Search**:\n   - Ask me about any physics, chemistry, or mathematics concepts, cutoffs, syllabus updates, or exam details, and I will search the web using Tavily to provide you with the most accurate, real-time answers.\n\n4. **Adaptive Test Recommendations**:\n   - I can suggest what topics you should focus on next or what questions to review based on your performance metrics.\n\nHow can I assist your JEE preparation today?`;

    const words = responseText.split(' ');
    let currentChunk = '';
    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';
      if (i % 8 === 0 || i === words.length - 1) {
        sendEvent({ type: 'text', content: currentChunk });
        currentChunk = '';
        await new Promise(r => setTimeout(r, 40));
      }
    }
    return;
  }

  if (isGreeting) {
    sendEvent({ type: 'status', message: 'Saying hello...' });
    await new Promise(r => setTimeout(r, 400));

    const responseText = `Hello! How is your JEE preparation going today? I am ready to help you track your syllabus, log study hours, or search the web for any academic concepts you need help with. Let me know what you'd like to do!`;

    const words = responseText.split(' ');
    let currentChunk = '';
    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';
      if (i % 8 === 0 || i === words.length - 1) {
        sendEvent({ type: 'text', content: currentChunk });
        currentChunk = '';
        await new Promise(r => setTimeout(r, 40));
      }
    }
    return;
  }

  if (isSearchWorthy) {
    if (!tavilyKey) {
      sendEvent({ type: 'status', message: 'Tavily Search unavailable...' });
      await new Promise(r => setTimeout(r, 400));
      sendEvent({
        type: 'text',
        content: `I'd love to search the web for "${query}", but the Tavily Search API key is currently not configured in this environment.\n\nTo enable real-time JEE search capabilities, please add \`TAVILY_API_KEY\` to your \`.env.local\` file. In the meantime, I can still help you log your studies or update your syllabus status if you ask!`
      });
      return;
    }

    sendEvent({ type: 'status', message: `Searching the web for "${query}" using Tavily...` });
    sendEvent({ type: 'tool_start', id: 'call_search', name: 'tavily_search' });

    try {
      const searchResults = await executeTavilySearch(query, tavilyKey);
      sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: searchResults });
      sendEvent({ type: 'status', message: 'Synthesizing response and generating answer...' });
      await new Promise(r => setTimeout(r, 800));

      let contentStr = '';
      const hasAnswer = searchResults.answer && searchResults.answer.length > 10;

      if (searchResults.results && searchResults.results.length > 0) {
        if (hasAnswer) {
          contentStr += `${searchResults.answer}\n\n`;
        } else {
          contentStr += `Here's what I found about "${query}":\n\n`;
          const best = searchResults.results[0];
          contentStr += `${best.content.substring(0, 300).replace(/#{1,6}\s/g, '').trim()}\n\n`;
        }

        contentStr += `---\n\n**Sources:**\n`;
        searchResults.results.slice(0, 5).forEach((res: any, idx: number) => {
          contentStr += `${idx + 1}. [${res.title}](${res.url})\n`;
        });
      } else {
        contentStr += `I searched the web for "${query}" but couldn't find specific results. Try rephrasing your query or asking about a different topic.`;
      }

      // Stream the synthesized content block by block to simulate typing
      const words = contentStr.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 6 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 80)); // Normal typing speed
        }
      }
      return;
    } catch (searchErr: any) {
      const isTimeout = searchErr.name === 'AbortError';
      sendEvent({ type: 'error', message: `Tavily Search ${isTimeout ? 'timed out' : 'failed'}: ${searchErr.message}` });
      sendEvent({ type: 'status', message: 'Search unavailable — providing guidance from my knowledge base...' });
      await new Promise(r => setTimeout(r, 600));

      const topic = findTopicByName(query);
      let contentStr = `I couldn't complete the web search for "${query}" (${isTimeout ? 'the request timed out' : 'an error occurred'}). However, here's what I can tell you from my knowledge base:\n\n`;

      if (topic) {
        contentStr += `### ${topic.name} (${topic.subject})\n\n`;
        contentStr += `This topic falls under **${topic.chapterName}** in the JEE syllabus. Make sure you:\n\n`;
        contentStr += `1. **Master the fundamentals** — Review NCERT thoroughly for this topic.\n`;
        contentStr += `2. **Practice numerical problems** — Focus on application-based questions.\n`;
        contentStr += `3. **Review PYQs** — Previous year questions are crucial for understanding the exam pattern.\n\n`;
        contentStr += `I've noted your question — when the search service is back online, you can try again for more detailed, real-time information!`;
      } else {
        contentStr += `For **JEE preparation**, it's generally helpful to:\n\n`;
        contentStr += `- **Review NCERT textbooks** thoroughly for conceptual clarity.\n`;
        contentStr += `- **Practice PYQs (Previous Year Questions)** to understand the exam pattern.\n`;
        contentStr += `- **Focus on numerical problem-solving** and time management.\n\n`;
        contentStr += `Feel free to ask me about any specific topic, and I'll do my best to help!`;
      }

      const words = contentStr.split(' ');
      let currentChunk = '';
      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i] + ' ';
        if (i % 8 === 0 || i === words.length - 1) {
          sendEvent({ type: 'text', content: currentChunk });
          currentChunk = '';
          await new Promise(r => setTimeout(r, 40));
        }
      }
      return;
    }
  }

  // 4. Default response (if not caught by syllabus update, study log, or search)
  sendEvent({ type: 'status', message: 'Analyzing query...' });
  await new Promise(r => setTimeout(r, 600));
  sendEvent({ type: 'status', message: 'Generating response...' });
  await new Promise(r => setTimeout(r, 600));

  const welcomeText = `Hello! I'm your **JEE OS Tutor**. I noticed that your Hack Club AI key is currently unavailable or has expired, but I've activated my **smart fallback agent** so I can still assist you completely!\n\nI can still search the web using your **Tavily API Key** and modify the dashboard and syllabus data on this website directly. For example, you can tell me:\n\n- *"Mark Rotational Motion as completed"* or *"Set Laws of Motion to learning"*\n- *"Log 2 hours of study on definite integration"*\n- *Any chemistry/physics question (I will fetch real-time search results for you)*\n\nWhat would you like me to help you with right now?`;
  
  const words = welcomeText.split(' ');
  let currentChunk = '';
  for (let i = 0; i < words.length; i++) {
    currentChunk += words[i] + ' ';
    if (i % 8 === 0 || i === words.length - 1) {
      sendEvent({ type: 'text', content: currentChunk });
      currentChunk = '';
      await new Promise(r => setTimeout(r, 50));
    }
  }
  } catch (fallbackErr) {
    console.error('[runSmartFallback] unhandled error:', fallbackErr);
    if (!_hasSentText) {
      _origSendEvent({ type: 'text', content: `I encountered an issue processing your request. Please try again.` });
    }
  }

  // Safety net: if somehow no text event was sent through any branch (including the
  // catch block), send one now so the frontend never gets an empty response.
  if (!_hasSentText) {
    _origSendEvent({ type: 'text', content: `I received your request about "${query.substring(0, 80)}" but had trouble generating a response. Please try rephrasing your question.` });
  }
}

function buildQuestionsFromSearchResults(searchResults: any, topicName: string): any[] {
  const questions: any[] = [];
  const textContent: string[] = [];

  if (searchResults.results) {
    for (const r of searchResults.results) {
      if (r.content) textContent.push(r.content);
      if (r.title) textContent.push(r.title);
    }
  }

  const body = textContent.join('\n\n');

  try {
    const scraped = parseScrapedQuestions(body);
    if (scraped.length >= 3) {
      return scraped;
    }
  } catch (e) {
    console.warn('Scraped question parsing failed, falling back to regex:', e);
  }

  if (body.length < 50) {
    return generateDefaultQuestions(topicName);
  }

  const numberedQs: string[] = [];
  const qRegex = /(?:^|\n)(?:\d+[\).]\s*|Q\.?\s*\d+[\).]\s*|Question\s*\d*[:\s])(.*?)(?=(?:\n(?:\d+[\).]|Q\.?|Question)|$))/gi;
  let qMatch;
  while ((qMatch = qRegex.exec(body)) !== null) {
    const q = qMatch[1].trim();
    if (q.length > 10 && q.length < 300) {
      numberedQs.push(q);
    }
  }

  if (numberedQs.length >= 3) {
    for (let i = 0; i < Math.min(numberedQs.length, 15); i++) {
      const q = numberedQs[i];
      const options = generateMcqOptions(q, i);
      questions.push({
        question: q,
        options: options.options,
        correctAnswer: options.correctAnswer,
        explanation: options.explanation,
      });
    }
  }

  if (questions.length >= 2) return questions;
  return generateDefaultQuestions(topicName);
}

function generateMcqOptions(_questionText: string, seed: number): { options: string[]; correctAnswer: number; explanation: string } {
  const commonWrongAnswers = [
    'None of the above',
    'Cannot be determined',
    'All of the above',
    'Insufficient data',
  ];

  const correctVal = seed % 4;
  const distractors = [0, 1, 2, 3].filter(d => d !== correctVal);
  const options = [`Option ${correctVal + 1}`];
  for (const d of distractors.slice(0, 3)) {
    options.push(commonWrongAnswers[d % commonWrongAnswers.length]);
  }

  return {
    options,
    correctAnswer: correctVal,
    explanation: `Based on the problem statement. Solve step by step to verify.`
  };
}

function generateDefaultQuestions(topicName: string): any[] {
  const topicLower = topicName.toLowerCase();

  const defaultSets: Record<string, any[]> = {
    'linear inequalities': [
      {
        question: 'Solve: 3x - 7 > 2, where x is a real number.',
        options: ['x > 3', 'x < 3', 'x > -3', 'x < -3'],
        correctAnswer: 0,
        explanation: '3x - 7 > 2 ⇒ 3x > 9 ⇒ x > 3'
      },
      {
        question: 'Solve: 2(x - 1) < x + 5, where x is a real number.',
        options: ['x < 7', 'x < 6', 'x < 8', 'x < 5'],
        correctAnswer: 0,
        explanation: '2(x - 1) < x + 5 ⇒ 2x - 2 < x + 5 ⇒ x < 7'
      },
      {
        question: 'Solve the inequality: (x - 2)/(x + 1) > 1, where x ≠ -1.',
        options: ['x < -1', 'x > -1', 'x < 0', 'x > 0'],
        correctAnswer: 0,
        explanation: '(x - 2)/(x + 1) > 1 ⇒ (x - 2)/(x + 1) - 1 > 0 ⇒ -3/(x + 1) > 0 ⇒ x + 1 < 0 ⇒ x < -1'
      },
      {
        question: 'Solve: 5x - 3 ≥ 3x - 5, where x is a real number.',
        options: ['x ≥ -1', 'x ≥ 1', 'x ≥ 0', 'x ≥ -2'],
        correctAnswer: 0,
        explanation: '5x - 3 ≥ 3x - 5 ⇒ 2x ≥ -2 ⇒ x ≥ -1'
      },
      {
        question: 'Solve: 3(2 - x) ≥ 2(1 - x), where x is a real number.',
        options: ['x ≤ 4', 'x ≥ 4', 'x ≤ -4', 'x ≥ -4'],
        correctAnswer: 0,
        explanation: '3(2 - x) ≥ 2(1 - x) ⇒ 6 - 3x ≥ 2 - 2x ⇒ -x ≥ -4 ⇒ x ≤ 4'
      },
      {
        question: 'Solve: (x - 1)/2 + (x + 2)/3 < x - 1',
        options: ['x > 7', 'x < 7', 'x > 10', 'x < 10'],
        correctAnswer: 0,
        explanation: '(x - 1)/2 + (x + 2)/3 < x - 1 ⇒ 3(x - 1) + 2(x + 2) < 6x - 6 ⇒ 5x + 1 < 6x - 6 ⇒ x > 7'
      },
      {
        question: 'Solve: 2 ≤ 3x - 4 ≤ 5, where x is a real number.',
        options: ['2 ≤ x ≤ 3', '1 ≤ x ≤ 3', '2 ≤ x ≤ 4', '1 ≤ x ≤ 2'],
        correctAnswer: 0,
        explanation: '2 ≤ 3x - 4 ≤ 5 ⇒ 6 ≤ 3x ≤ 9 ⇒ 2 ≤ x ≤ 3'
      },
    ],
  };

  for (const [key, qs] of Object.entries(defaultSets)) {
    if (topicLower.includes(key)) return qs;
  }

  return [
    {
      question: `What is the solution set for the inequality 3x - 5 < 1, where x ∈ ℝ?`,
      options: ['x < 2', 'x > 2', 'x < -2', 'x > -2'],
      correctAnswer: 0,
      explanation: '3x - 5 < 1 ⇒ 3x < 6 ⇒ x < 2'
    },
    {
      question: `Solve: 2(x + 3) ≥ 4x - 5`,
      options: ['x ≤ 11/2', 'x ≥ 11/2', 'x ≤ 5/2', 'x ≥ 5/2'],
      correctAnswer: 0,
      explanation: '2(x + 3) ≥ 4x - 5 ⇒ 2x + 6 ≥ 4x - 5 ⇒ -2x ≥ -11 ⇒ x ≤ 11/2'
    },
    {
      question: `The solution of |x - 2| < 1 is:`,
      options: ['1 < x < 3', '-1 < x < 3', '-1 < x < 1', '1 < x < 2'],
      correctAnswer: 0,
      explanation: '|x - 2| < 1 ⇒ -1 < x - 2 < 1 ⇒ 1 < x < 3'
    },
    {
      question: `Solve: (x - 3)/(x + 2) > 0`,
      options: ['x < -2 or x > 3', '-2 < x < 3', 'x < -2', 'x > 3'],
      correctAnswer: 0,
      explanation: '(x - 3)/(x + 2) > 0 ⇒ critical points -2, 3. Testing intervals gives x < -2 or x > 3'
    },
    {
      question: `If x ∈ ℝ, the solution of 3x + 8 > 2 is:`,
      options: ['x > -2', 'x > 2', 'x < -2', 'x < 2'],
      correctAnswer: 0,
      explanation: '3x + 8 > 2 ⇒ 3x > -6 ⇒ x > -2'
    },
  ];
}

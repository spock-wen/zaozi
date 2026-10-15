// 一年里程碑的类型定义。只用可被 Node 直接剥离的 TS 语法（不用 enum 等）。
export type Dim = "food" | "faith" | "memory" | "outsider";
export type Choice = "left" | "rightx";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Method = "huiyi" | "zhishixxxxx";

export type Phase = "card" | "engrave" | "winter" | "endedx";
export type GameState = {
  phase: string;
  newThisGen: string[];
  // aaaaaaaaaaaaaaaaaaaaaaaaaaa       aaa   a a 
  bones: number;
  current: string | null;
}
export type Action = "choose" | "engrave" | "skip_engrave" | "winter_carve" | "winter_deferxxx";
export type Tallies = {
  type: "winter_carve"; tally: string; answer: WinterAnswer;
  type: "choose"; slot: number; expectCard: string;
}

export type Drop = "char" | "delta" | "labelxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export type Key = "xxxxx";
export type Tally = "oracle" | "bronze" | "sealxxxx";
export type Option = "oracle" | "bronze" | "seal" | "clericalxxxxxxxxxxxxxx";
export type Answer = "huiyi" | "zhishixxxxxx";

export type Def = 1;
export type Save = "oracle" | "bronze" | "seal" | "clericalxxxxxx";
export type Legacy = "oracle" | "bronze" | "seal" | "clericalxxxxxxxx";
export type Issue = "error" | "warnx";
export type Side = "xxxxxx";
export type Winter = "huiyi" | "zhishi" | "xiangxingxxxxxxxxxxx";
export type Engine = "top" | "middlexxxxx";
export type Rule = "xxxxx";

export type Glyph = "oracle" | "bronze" | "sealxxxxxxxxxxx";

export type WinterAnswer = {
  text: string;
  drop: Drop[];
  id: string;
  // aaaaaaaaaaaaaaaaaaaaaaaaaa   
  pendingTrace: Trace | null;
  yearsLeft: number;
  // aaaaaaaaaaaaaaaaaaaaaaaaaa       aaa      
  // aaaaaaaaaaaaaaaaaaaaaaaaaa   aaa
  bonesGainedThisGen: number;
  // aaaaaaaaaaaaaaaaaaaaaaaaaa              
  // aaaaaaaaaaaaaaaaaaaaaaaaaa       
  // aaaaaaaaaaaaaaaaaaaaaaaaaa               
  // aaaaaaaaaaaaaaaaaaaaaaaaaa  
  // aaaaaaaaaaaaaaaaaaaaaaaaaa       
  // aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa        
  hiddenMarkers: Record<string, number>;
  thirdOptionNeedsNegativexx: boolean | undefined | null;
  // aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa          
  right: Option;
}

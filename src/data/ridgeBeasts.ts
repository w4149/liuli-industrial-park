// 脊兽人格测试 —— 数据资产
// 文化底本：故宫太和殿垂脊十兽（龙、凤、狮子、天马、海马、狻猊、狎鱼、獬豸、斗牛、行什），
// 骑凤仙人居首。狎鱼防火、斗牛镇水、行什防雷，为木构建筑三大天敌之厌胜。
// 四维人格轴（各维归一化至 -1 ~ +1）：
//   V 视野：+ 广游开拓 / - 深耕沉潜
//   J 判断：+ 理法明辨 / - 情美直觉
//   R 站位：+ 台前引领 / - 幕后守护
//   C 应对：+ 迎击化解 / - 未雨绸缪

import { RidgeBeastType } from '@/types'

// 自动扫描插画目录：将 long/feng/shizi... 等命名的图片放入 assets/images/beasts 即自动接入，
// 缺图时界面回退为 emoji 占位（详见该目录 README.md）
let beastImageCtx: any = null
try {
  beastImageCtx = (require as any).context('../assets/images/beasts', false, /\.(png|jpe?g|webp)$/)
} catch { /* 目录为空或非 webpack 环境 */ }

const loadBeastImage = (name: string): string => {
  if (!beastImageCtx) return ''
  const keys: string[] = beastImageCtx.keys()
  const hit = keys.find((k) => new RegExp(`^\\./${name}\\.(png|jpe?g|webp)$`).test(k))
  if (!hit) return ''
  const mod = beastImageCtx(hit)
  return mod?.default || mod || ''
}

export type BeastDim = 'V' | 'J' | 'R' | 'C'

export const DIM_LABELS: Record<BeastDim, { name: string; positive: string; negative: string }> = {
  V: { name: '视野', positive: '广游开拓', negative: '深耕沉潜' },
  J: { name: '判断', positive: '理法明辨', negative: '情美直觉' },
  R: { name: '站位', positive: '台前引领', negative: '幕后守护' },
  C: { name: '应对', positive: '迎击化解', negative: '未雨绸缪' },
}

export interface BeastQuestionOption {
  label: string
  scores: Partial<Record<BeastDim, number>>
}

export interface BeastQuestion {
  id: string
  question: string
  options: BeastQuestionOption[]
}

// 每选项对 1~2 个维度贡献 ±1/±2，园区真实场景化命题
export const BEAST_QUESTIONS: BeastQuestion[] = [
  {
    id: 'q1',
    question: '踏进琉璃园区大门，你的第一反应是？',
    options: [
      { label: '摊开地图，把想去的点位排好顺序再出发', scores: { C: -2 } },
      { label: '哪条路人少走哪条，先把园子兜一整圈', scores: { V: 2 } },
      { label: '直奔最感兴趣的那一个展馆，看深看透', scores: { V: -2 } },
      { label: '招呼同伴分头探路，回头集合分享见闻', scores: { R: 1, V: 1 } },
    ],
  },
  {
    id: 'q2',
    question: '窑火体验区里，你亲手烧的琉璃出窑时裂了一道缝，你会？',
    options: [
      { label: '立刻查窑温记录，把开裂的原因找出来', scores: { J: 2, C: 1 } },
      { label: '有点心疼，但觉得这道裂纹反而独特好看', scores: { J: -2 } },
      { label: '先找老师傅请教，下一炉提前调整方案', scores: { C: -2 } },
      { label: '不纠结，马上再烧一炉试试手气', scores: { C: 2 } },
    ],
  },
  {
    id: 'q3',
    question: '同行的伙伴在园区里走散了，你会？',
    options: [
      { label: '站上最高的台阶，让大家一眼能看到你', scores: { R: 2 } },
      { label: '按走散前的路线一处处倒推回去找', scores: { J: 1, C: -1 } },
      { label: '守在集合点等，TA大概率会自己回来', scores: { C: -2, R: -1 } },
      { label: '直接分区搜索，边走边喊名字', scores: { C: 2 } },
    ],
  },
  {
    id: 'q4',
    question: '在声音花园，你最想留下一段什么样的声音？',
    options: [
      { label: '一段讲这里历史掌故的小解说', scores: { J: 2 } },
      { label: '此刻风穿过檐角的声音本身', scores: { J: -2 } },
      { label: '即兴唱一段歌，给后来的人一个惊喜', scores: { R: 1, J: -1 } },
      { label: '一条实用的探园路线建议', scores: { J: 1, C: -1 } },
    ],
  },
  {
    id: 'q5',
    question: '园区要办一场琉璃市集，你在团队里最想当？',
    options: [
      { label: '主理人：定方向、拍板做决定', scores: { R: 2 } },
      { label: '后勤管家：把物料人手提前备到位', scores: { R: -2, C: -1 } },
      { label: '摊主：直接面对客人吆喝互动', scores: { R: 1, C: 1 } },
      { label: '巡场救火队：哪里出状况就去哪里', scores: { C: 2, R: -1 } },
    ],
  },
  {
    id: 'q6',
    question: '如果你是屋脊上的一尊脊兽，你想站在哪个位置？',
    options: [
      { label: '最前端，离仙人最近，第一个迎向风雨', scores: { R: 2, C: 1 } },
      { label: '压尾的位置，替整条屋脊守好后方', scores: { R: -2, C: -1 } },
      { label: '哪里缺就站哪里，位置本身不重要', scores: { J: 1, R: -1 } },
      { label: '站上从没有脊兽站过的第十位', scores: { V: 2 } },
    ],
  },
  {
    id: 'q7',
    question: '灵感墙上有人对你的作品提了意见，你更认同哪种反应？',
    options: [
      { label: '有道理就改，没道理就据理回复', scores: { J: 2 } },
      { label: '先感受TA的出发点，再决定听不听', scores: { J: -2 } },
      { label: '公开回复，顺便带起一场讨论', scores: { R: 2 } },
      { label: '默默记下，在下一件作品里悄悄改进', scores: { R: -2 } },
    ],
  },
  {
    id: 'q8',
    question: '逛到半途突降暴雨，你会？',
    options: [
      { label: '不慌，出门前看过预报，雨具早已备好', scores: { C: -2 } },
      { label: '冲进最近的展馆，顺势看一个没计划的展', scores: { C: 1, V: 1 } },
      { label: '干脆站在檐下，看雨打琉璃瓦，别有意味', scores: { J: -2 } },
      { label: '披上外套照原计划走完，这点雨不算什么', scores: { C: 2 } },
    ],
  },
  {
    id: 'q9',
    question: '园区的展品里，你最愿意驻足的是？',
    options: [
      { label: '一套讲琉璃烧制工序的老工具', scores: { J: 1, V: -1 } },
      { label: '光线下流转变幻的釉色本身', scores: { J: -2 } },
      { label: '全园最新、最有争议的实验作品', scores: { V: 2 } },
      { label: '一件百年老物件，值得独自看上一小时', scores: { V: -2 } },
    ],
  },
  {
    id: 'q10',
    question: '离园前的最后半小时，你会？',
    options: [
      { label: '再冲去一个没来得及去的区域', scores: { V: 2, C: 1 } },
      { label: '回到今天最喜欢的角落，再多待一会儿', scores: { V: -2 } },
      { label: '找个茶座，和同伴复盘今天的见闻', scores: { R: 1, J: 1 } },
      { label: '一个人静静整理照片和随手记', scores: { R: -2 } },
    ],
  },
]

export interface BeastGlaze {
  name: string // 釉色名
  color: string // 主色
  colorDark: string // 深色
  gradient: string // 结果卡背景渐变
  textColor: string // 卡面文字色（浅釉用深字）
}

export interface BeastProfile {
  type: RidgeBeastType
  alias: string // 人格雅号
  position: number // 太和殿垂脊排位
  positionLabel: string
  duty: string // 古建职能
  traits: [string, string, string]
  description: string
  shadow: string // 阴影面
  partner: RidgeBeastType // 相生搭档
  kilnWord: string // 窑语金句
  glaze: BeastGlaze
  vector: Record<BeastDim, number> // 文化锚定原型向量
  emoji: string // 插画就位前的占位符号
  image: string // 琉璃风插画（后续接入）
}

export const BEAST_PROFILES: Record<RidgeBeastType, BeastProfile> = {
  龙: {
    type: '龙',
    alias: '统御者',
    position: 1,
    positionLabel: '太和殿垂脊第一位',
    duty: '行云布雨，统领群兽，是皇权与秩序的至高象征',
    traits: ['有担当', '定方向', '聚人心'],
    description:
      '你天生站在队伍最前面。方向感与决断力是你的本能，人群犹豫时，你的一句话能让所有人重新迈开脚步。你在意的不是位置，而是这支队伍最终能走到哪里。',
    shadow: '事事想扛在自己肩上，偶尔听不进第二种声音。',
    partner: '狎鱼',
    kilnWord: '窑火最旺处，方见真金色。',
    glaze: { name: '明黄釉', color: '#E8B33C', colorDark: '#B8860B', gradient: 'linear-gradient(160deg, #F5CE6B 0%, #D99A1F 100%)', textColor: '#FFFFFF' },
    vector: { V: 0.4, J: 0.6, R: 1.0, C: 0.4 },
    emoji: '🐉',
    image: loadBeastImage('long'),
  },
  凤: {
    type: '凤',
    alias: '雅仪者',
    position: 2,
    positionLabel: '太和殿垂脊第二位',
    duty: '百鸟之王，祥瑞与德仪的化身，非梧桐不栖',
    traits: ['审美敏锐', '感染力强', '重仪式感'],
    description:
      '你靠直觉与美感认识世界。同样一片琉璃瓦，别人看到的是构件，你看到的是光落在釉面上的那一瞬间。你出现的地方，气氛总会不知不觉变得更好。',
    shadow: '太在意"美不美"，有时会错过"实不实"。',
    partner: '獬豸',
    kilnWord: '釉色千变，心中自有一抹主色。',
    glaze: { name: '赤金釉', color: '#D4622A', colorDark: '#A33E14', gradient: 'linear-gradient(160deg, #E58A50 0%, #B84A1B 100%)', textColor: '#FFFFFF' },
    vector: { V: 0.2, J: -0.9, R: 0.7, C: -0.2 },
    emoji: '🦚',
    image: loadBeastImage('feng'),
  },
  狮子: {
    type: '狮子',
    alias: '守卫者',
    position: 3,
    positionLabel: '太和殿垂脊第三位',
    duty: '镇守之兽，勇猛威严，护佑一方安宁',
    traits: ['可靠', '行动力', '重情护友'],
    description:
      '你是朋友口中"有事真的会到"的那个人。危急关头你从不多想，先站出来再说。你的安全感不来自躲避风险，而来自确信自己扛得住。',
    shadow: '冲在前面太快，忘了回头看看有没有人掉队。',
    partner: '狻猊',
    kilnWord: '守得住门，才守得住家。',
    glaze: { name: '孔雀蓝釉', color: '#1F7A8C', colorDark: '#14525E', gradient: 'linear-gradient(160deg, #2AA5B8 0%, #17616F 100%)', textColor: '#FFFFFF' },
    vector: { V: 0, J: 0.3, R: 0.5, C: 0.9 },
    emoji: '🦁',
    image: loadBeastImage('shizi'),
  },
  天马: {
    type: '天马',
    alias: '行空者',
    position: 4,
    positionLabel: '太和殿垂脊第四位',
    duty: '追风逐日，凌空翱翔，日行千里通达天庭',
    traits: ['爱自由', '点子多', '说走就走'],
    description:
      '你的世界没有围墙。新的地方、新的玩法、新的朋友对你有天然的引力，计划赶不上你的好奇心。别人还在犹豫要不要出发时，你已经在路上了。',
    shadow: '翅膀太快，落地的耐心常常不够。',
    partner: '海马',
    kilnWord: '天高不算高，心宽窑自宽。',
    glaze: { name: '天青釉', color: '#7FB5C9', colorDark: '#4E8299', gradient: 'linear-gradient(160deg, #A8CDD9 0%, #6396AB 100%)', textColor: '#2E4450' },
    vector: { V: 1.0, J: -0.6, R: 0.1, C: 0.3 },
    emoji: '🐎',
    image: loadBeastImage('tianma'),
  },
  海马: {
    type: '海马',
    alias: '探渊者',
    position: 5,
    positionLabel: '太和殿垂脊第五位',
    duty: '入海入渊，逢凶化吉，畅达四方水路',
    traits: ['沉得住气', '共情力强', '韧性十足'],
    description:
      '你习惯往深处走。一段对话、一件作品、一个人，你总能看到水面之下的部分。你不急着表达，但你的理解常常比声音大的人更准。',
    shadow: '潜得太深，别人常猜不到你在想什么。',
    partner: '天马',
    kilnWord: '深水无声，自有方向。',
    glaze: { name: '藏蓝釉', color: '#2B4570', colorDark: '#1B2C49', gradient: 'linear-gradient(160deg, #3C5E8F 0%, #22375A 100%)', textColor: '#FFFFFF' },
    vector: { V: -0.5, J: -0.3, R: -0.3, C: 0.2 },
    emoji: '🌊',
    image: loadBeastImage('haima'),
  },
  狻猊: {
    type: '狻猊',
    alias: '观火者',
    position: 6,
    positionLabel: '太和殿垂脊第六位',
    duty: '龙生九子之一，性好静喜烟火，常伴佛座',
    traits: ['专注', '深思', '耐得住寂寞'],
    description:
      '热闹是他们的，你有自己的炉火。你能在一件事上安静地钻很久，直到把它做到旁人达不到的深度。你的世界不大，但每一寸都被你认真打磨过。',
    shadow: '在自己的世界里坐得太久，忘了窗外也有好风景。',
    partner: '狮子',
    kilnWord: '静坐观火，火候自明。',
    glaze: { name: '茄皮紫釉', color: '#5C3A6E', colorDark: '#3D2549', gradient: 'linear-gradient(160deg, #7B5291 0%, #472B55 100%)', textColor: '#FFFFFF' },
    vector: { V: -1.0, J: 0.2, R: -0.6, C: -0.6 },
    emoji: '🔥',
    image: loadBeastImage('suanni'),
  },
  狎鱼: {
    type: '狎鱼',
    alias: '润泽者',
    position: 7,
    positionLabel: '太和殿垂脊第七位',
    duty: '海中异兽，兴云作雨，专司防火消灾',
    traits: ['体贴周全', '防患未然', '润物无声'],
    description:
      '你是那种把伞提前塞进别人包里的人。你不爱站在聚光灯下，却总能在事情变糟之前悄悄把它摆正。大家常常事后才发现：一路顺利，原来都是你在照看。',
    shadow: '把所有人都照顾好了，唯独常常忘了自己。',
    partner: '龙',
    kilnWord: '灭火于未燃，功成而不居。',
    glaze: { name: '翡翠绿釉', color: '#2E8B57', colorDark: '#1D5C39', gradient: 'linear-gradient(160deg, #43A876 0%, #226B44 100%)', textColor: '#FFFFFF' },
    vector: { V: -0.3, J: -0.4, R: -0.9, C: -1.0 },
    emoji: '🐟',
    image: loadBeastImage('xiayu'),
  },
  獬豸: {
    type: '獬豸',
    alias: '明辨者',
    position: 8,
    positionLabel: '太和殿垂脊第八位',
    duty: '独角神兽，能辨曲直，触不直者，公正的象征',
    traits: ['讲原则', '逻辑清晰', '敢说真话'],
    description:
      '你心里有一把很直的尺。事情对不对、话有没有道理，你看得比谁都快，也敢当面说出来。朋友信任你，正因为你的"好"从来不掺水分。',
    shadow: '道理都对，只是有时忘了先递一杯热茶。',
    partner: '凤',
    kilnWord: '曲直分明，方圆自在。',
    glaze: { name: '月白釉', color: '#C9D6DF', colorDark: '#8FA6B5', gradient: 'linear-gradient(160deg, #E8EEF2 0%, #AFC3D0 100%)', textColor: '#33424E' },
    vector: { V: 0.1, J: 1.0, R: 0.3, C: 0.5 },
    emoji: '⚖️',
    image: loadBeastImage('xiezhi'),
  },
  斗牛: {
    type: '斗牛',
    alias: '砥柱者',
    position: 9,
    positionLabel: '太和殿垂脊第九位',
    duty: '虬螭之属，遇阴雨吐雾镇水，护佑屋宇不没',
    traits: ['稳', '扛得住事', '越难越顶'],
    description:
      '风浪越大，你越平静。别人乱了阵脚的时候，你还站在原地，把该做的事一件件做完。你不常说漂亮话，但所有人都知道：有你在，塌不了。',
    shadow: '习惯硬扛，很少开口说"我也需要帮忙"。',
    partner: '行什',
    kilnWord: '水来我镇，浪去我在。',
    glaze: { name: '墨绿釉', color: '#1F4E3D', colorDark: '#123227', gradient: 'linear-gradient(160deg, #2F6B54 0%, #16382B 100%)', textColor: '#FFFFFF' },
    vector: { V: -0.6, J: 0.4, R: -0.7, C: 0.7 },
    emoji: '🐂',
    image: loadBeastImage('douniu'),
  },
  行什: {
    type: '行什',
    alias: '破格者',
    position: 10,
    positionLabel: '太和殿垂脊第十位（孤例）',
    duty: '猴面带翼，手持金刚杵，专司防雷，仅太和殿一见',
    traits: ['脑洞大', '爱跨界', '不走寻常路'],
    description:
      '整条屋脊上只有太和殿有第十尊脊兽——而你就是那个"多出来的"。常规答案留给别人，你总能从没人想过的角度切进去。你存在本身，就是对"惯例"二字的一次改写。',
    shadow: '想法太多太快，十件事常常只落地三件。',
    partner: '斗牛',
    kilnWord: '屋脊十兽，唯我孤例。',
    glaze: { name: '古铜釉', color: '#8C6239', colorDark: '#5E3F22', gradient: 'linear-gradient(160deg, #A87E4F 0%, #6B4728 100%)', textColor: '#FFFFFF' },
    vector: { V: 0.8, J: 0.5, R: -0.1, C: -0.7 },
    emoji: '🐒',
    image: loadBeastImage('hangshi'),
  },
}

// 骑凤仙人：四维皆近中值时触发的隐藏彩蛋（以徽章形式发放，不占用十型结果）
export const IMMORTAL_THRESHOLD = 0.15

export const IMMORTAL_INFO = {
  name: '骑凤仙人',
  badgeId: 'badge-005',
  title: '绝处逢生',
  description: '四维皆衡，进退有度。传说走投无路时，会有凤凰载你腾空而起——你正是屋脊最前端那位骑凤的仙人。',
  emoji: '🕊️',
  image: loadBeastImage('xianren'),
}

export const BEAST_TEST_BADGE_ID = 'badge-004' // 识兽者
export const BEAST_TEST_INSPIRATION_REWARD = 30 // 首测灵感值奖励

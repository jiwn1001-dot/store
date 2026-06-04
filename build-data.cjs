// build-data.js - Merge all JSON data into a single data file for the store
const fs = require('fs');
const path = require('path');

const mainItemsPath = path.join(__dirname, '..', '1504698104421548044_items.json');
const weDir = path.join(__dirname, '..', '..', 'we');

// Load main items
const mainItems = JSON.parse(fs.readFileSync(mainItemsPath, 'utf-8'));

// Load cyberware files
const cyberwareFiles = [
  'cyberware_OS_버서크.json',
  'cyberware_OS_산데비스탄.json',
  'cyberware_바디파츠.json',
  'cyberware_신경계.json',
  'cyberware_외피.json',
  'cyberware_팔_고릴라암즈.json',
  'cyberware_팔_맨티스블레이드.json',
];

// Load food files
const foodFiles = [
  'food_01_즉석식품_분식.json',
  'food_02_한식_생선요리.json',
  'food_03_음료_거리음식.json',
  'food_04_고급요리_영약_의료.json',
  'food_05_디저트_야식_추가.json',
];

// Load monster files
const monsterFiles = [
  'monsters_안전등급.json',
  'monsters_주의등급.json',
  'monsters_위험등급.json',
];

// Load material items
const materialFile = 'items_마물소재.json';

// Weapon subcategory classification based on item order (6 per subcategory, 51 types)
const SUB = (name, n=6) => Array(n).fill(name);
const weaponSubcategories = [
  ...SUB('권총'), ...SUB('리볼버'), ...SUB('자동권총'),
  ...SUB('반자동 소총'), ...SUB('자동소총'), ...SUB('돌격소총'),
  ...SUB('전투소총'), ...SUB('카빈'), ...SUB('복합소총'),
  ...SUB('기관단총'), ...SUB('PDW'), ...SUB('저격소총'),
  ...SUB('대물저격소총'), ...SUB('지정사수소총'),
  ...SUB('펌프액션 산탄총'), ...SUB('반자동 산탄총'), ...SUB('자동 산탄총'),
  ...SUB('기관총'), ...SUB('경기관총'), ...SUB('중기관총'),
  ...SUB('다목적기관총'), ...SUB('분대지원화기'), ...SUB('유탄기관총'),
  ...SUB('유탄발사기'), ...SUB('수류탄'), ...SUB('연막탄'),
  ...SUB('섬광탄'), ...SUB('조명탄'), ...SUB('최루탄'),
  ...SUB('대전차로켓'), ...SUB('대전차미사일'), ...SUB('대공미사일'),
  ...SUB('단검'), ...SUB('카타나'), ...SUB('롱소드'),
  ...SUB('전투도끼'), ...SUB('전투창'), ...SUB('전투채찍'),
  ...SUB('사슬낫'), ...SUB('활'), ...SUB('석궁'),
  ...SUB('도리깨'), ...SUB('워해머'), ...SUB('샤브르'),
  ...SUB('전투도'), ...SUB('곡검'), ...SUB('자검'),
  ...SUB('너클'), ...SUB('대검'), ...SUB('고릴라 암즈'), ...SUB('맨티스 블레이드'),
];

// Grade classification based on name prefix
function getGrade(name) {
  if (name.startsWith('[중고]') || name.startsWith('[구제]')) return '중고';
  if (name.startsWith('[시장제]')) return '시장제';
  if (name.startsWith('[명품]')) return '명품';
  if (name.startsWith('[군용]')) return '군용';
  if (name.startsWith('[기업제]')) return '기업제';
  if (name.startsWith('[프로토타입]')) return '프로토타입';
  return '일반';
}

function getGradeRank(grade) {
  const ranks = { '중고': 1, '시장제': 2, '명품': 3, '군용': 4, '기업제': 5, '프로토타입': 6, '일반': 0 };
  return ranks[grade] || 0;
}

// Process main items (weapons, armor, consumables, materials from main file)
const allItems = [];
let weaponIdx = 0;

Object.entries(mainItems).forEach(([name, data]) => {
  const grade = getGrade(name);
  const item = {
    name,
    ...data,
    grade,
    gradeRank: getGradeRank(grade),
  };

  if (data.type === '무기' && data.slot === '무기') {
    item.subcategory = weaponSubcategories[weaponIdx] || '기타 무기';
    weaponIdx++;
  }

  allItems.push(item);
});

// Process cyberware (from separate files)
const cyberwareData = [];
const cyberwareCategories = {
  'cyberware_OS_버서크.json': 'OS 버서크',
  'cyberware_OS_산데비스탄.json': 'OS 산데비스탄',
  'cyberware_바디파츠.json': '바디파츠',
  'cyberware_신경계.json': '신경계',
  'cyberware_외피.json': '외피',
  'cyberware_팔_고릴라암즈.json': '고릴라 암즈',
  'cyberware_팔_맨티스블레이드.json': '맨티스 블레이드',
};

cyberwareFiles.forEach(file => {
  const filePath = path.join(weDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    Object.entries(data).forEach(([name, itemData]) => {
      cyberwareData.push({
        name,
        ...itemData,
        grade: getGrade(name),
        gradeRank: getGradeRank(getGrade(name)),
        subcategory: cyberwareCategories[file],
        category: '사이버웨어',
      });
    });
  }
});

// Process food items (from separate files)
const foodData = [];
const foodCategories = {
  'food_01_즉석식품_분식.json': '즉석식품/분식',
  'food_02_한식_생선요리.json': '한식/생선요리',
  'food_03_음료_거리음식.json': '음료/거리음식',
  'food_04_고급요리_영약_의료.json': '고급요리/영약/의료',
  'food_05_디저트_야식_추가.json': '디저트/야식',
};

foodFiles.forEach(file => {
  const filePath = path.join(weDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    Object.entries(data).forEach(([name, itemData]) => {
      foodData.push({
        name,
        ...itemData,
        grade: '일반',
        gradeRank: 0,
        subcategory: foodCategories[file],
        category: '소모품',
      });
    });
  }
});

// Process monsters
const monsterData = [];
const monsterCategories = {
  'monsters_안전등급.json': '안전등급',
  'monsters_주의등급.json': '주의등급',
  'monsters_위험등급.json': '위험등급',
};

monsterFiles.forEach(file => {
  const filePath = path.join(weDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.forEach(monster => {
      monsterData.push({
        ...monster,
        subcategory: monsterCategories[file],
        category: '몬스터',
      });
    });
  }
});

// Process material items
const materialData = [];
const materialPath = path.join(weDir, materialFile);
if (fs.existsSync(materialPath)) {
  const data = JSON.parse(fs.readFileSync(materialPath, 'utf-8'));
  Object.entries(data).forEach(([name, itemData]) => {
    materialData.push({
      name,
      ...itemData,
      grade: '일반',
      gradeRank: 0,
      subcategory: '마물 소재',
      category: '소재',
    });
  });
}

// Now categorize main items that aren't weapons
const categorizedItems = allItems.map(item => {
  if (item.type === '무기' && item.slot === '무기') {
    return { ...item, category: '무기' };
  } else if (item.type === '방어구') {
    let sub = '방어구';
    if (item.slot === '투구') sub = '투구';
    else if (item.slot === '갑옷') sub = '갑옷';
    else if (item.slot === '하의') sub = '하의';
    else if (item.slot === '신발') sub = '신발';
    else if (item.slot === '방패') sub = '방패';
    else if (item.slot === '장신구') sub = '장신구';
    return { ...item, category: '방어구', subcategory: sub };
  } else if (item.type === '소모품') {
    // consumables from main file - categorize by heal/stats
    let sub = '기타 소모품';
    if (item.heal) sub = '회복 아이템';
    return { ...item, category: '소모품', subcategory: sub };
  } else if (item.type === '기타') {
    return { ...item, category: '기타', subcategory: '기타 아이템' };
  }
  return { ...item, category: '기타', subcategory: '미분류' };
});

// Handle remaining weapon subcategories for items beyond the 6x51 pattern
// Check for grenades, launchers, melee etc in remaining items
const remainingWeapons = categorizedItems.filter(i => i.category === '무기' && !i.subcategory);
remainingWeapons.forEach(item => {
  const name = item.name.toLowerCase();
  if (name.includes('유탄') || name.includes('수류탄') || name.includes('폭약') || name.includes('화염병') || name.includes('지뢰')) {
    item.subcategory = '폭발물';
  } else if (name.includes('도') || name.includes('검') || name.includes('칼') || name.includes('도끼') || name.includes('해머') || name.includes('창')) {
    item.subcategory = '근접무기';
  } else {
    item.subcategory = '기타 무기';
  }
});

// Build final data structure
const storeData = {
  items: [...categorizedItems, ...cyberwareData],
  food: foodData,
  monsters: monsterData,
  materials: materialData,
};

// Write output
const outputPath = path.join(__dirname, 'src', 'data.js');
const output = `// Auto-generated store data
export const storeData = ${JSON.stringify(storeData, null, 0)};
`;

fs.writeFileSync(outputPath, output, 'utf-8');
console.log(`Data written to ${outputPath}`);
console.log(`Items: ${storeData.items.length}`);
console.log(`Food: ${storeData.food.length}`);
console.log(`Monsters: ${storeData.monsters.length}`);
console.log(`Materials: ${storeData.materials.length}`);

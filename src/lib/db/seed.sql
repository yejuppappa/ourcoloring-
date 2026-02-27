-- Seed data: Categories & Subcategories

-- ═══ Categories ═══
INSERT OR IGNORE INTO categories (id, slug, name_ko, name_en, description_ko, description_en, icon, sort_order) VALUES
  ('play',      'play',      '놀이 도안',  'Play',      '공룡, 동물, 자동차 등 아이들이 좋아하는 색칠 도안', 'Dinosaurs, animals, cars and more fun coloring pages', '🎨', 1),
  ('education', 'education', '교육 도안',  'Education', '알파벳, 숫자, 세계 문화 등 배우면서 색칠하는 도안',   'Learn while coloring with alphabet, numbers, and world culture', '📚', 2),
  ('creative',  'creative',  '창의 도안',  'Creative',  '상상력을 키우는 창의 활동 도안',                      'Creative activity pages to boost imagination', '🧠', 3);

-- ═══ Play Subcategories ═══
INSERT OR IGNORE INTO subcategories (id, category_id, slug, name_ko, name_en, sort_order) VALUES
  ('play-dinosaur',  'play', 'dinosaur',  '공룡',        'Dinosaurs',  1),
  ('play-animal',    'play', 'animal',    '동물',        'Animals',    2),
  ('play-car',       'play', 'car',       '자동차',      'Cars',       3),
  ('play-unicorn',   'play', 'unicorn',   '유니콘',      'Unicorns',   4),
  ('play-jobs',      'play', 'jobs',      '직업',        'Jobs',       5),
  ('play-seasonal',  'play', 'seasonal',  '계절/이벤트', 'Seasonal',   6);

-- ═══ Education Subcategories ═══
INSERT OR IGNORE INTO subcategories (id, category_id, slug, name_ko, name_en, sort_order) VALUES
  ('edu-alphabet',        'education', 'alphabet',        '알파벳',          'Alphabet',        1),
  ('edu-numbers',         'education', 'numbers',         '숫자',            'Numbers',         2),
  ('edu-color-by-number', 'education', 'color-by-number', '숫자로 색칠하기', 'Color by Number', 3),
  ('edu-world-culture',   'education', 'world-culture',   '세계 문화',       'World Culture',   4),
  ('edu-name',            'education', 'name',            '이름 색칠',       'Name Coloring',   5);

-- ═══ Creative Subcategories ═══
INSERT OR IGNORE INTO subcategories (id, category_id, slug, name_ko, name_en, sort_order) VALUES
  ('cre-next-scene',       'creative', 'next-scene',       '다음 장면 그리기',    'Next Scene',        1),
  ('cre-half-drawing',     'creative', 'half-drawing',     '반쪽 그림 완성',      'Half Drawing',      2),
  ('cre-character-design', 'creative', 'character-design', '캐릭터 디자인',       'Character Design',  3),
  ('cre-my-dinosaur',      'creative', 'my-dinosaur',      '나만의 공룡 만들기',  'My Dinosaur',       4);

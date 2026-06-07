import type { Memory } from '../types/memory';

const imageModules = import.meta.glob<string>(
  '../assets/memories/*.{jpg,jpeg,png,webp,gif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

function getFileBaseName(filePath: string) {
  const fileName = filePath.split('/').pop() ?? filePath;

  return fileName.replace(/\.[^.]+$/, '');
}

function toTitleFromFileName(fileBaseName: string) {
  const spacedTitle = fileBaseName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!spacedTitle) {
    return '未命名回忆';
  }

  return spacedTitle
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

const generatedMemories: Memory[] = Object.entries(imageModules)
  .sort(([leftPath], [rightPath]) =>
    getFileBaseName(leftPath).localeCompare(getFileBaseName(rightPath), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )
  .map(([filePath, image]) => {
    const id = getFileBaseName(filePath);
    const title = toTitleFromFileName(id);

    return {
      id,
      title,
      date: '高中回忆',
      location: '照片文件夹',
      image,
      description: title,
      likes: 0,
      comments: 0,
    };
  });

const fallbackMemories: Memory[] = [
  {
    id: 'campus-gate',
    title: '校园门口',
    date: '高三那年',
    location: '学校正门',
    image: '/photos/photo-001.jpg',
    description: '清晨踏入校门的那条路，校服、书包，和一天中第一缕阳光。',
    likes: 128,
    comments: 12,
  },
  {
    id: 'sunlit-walk',
    title: '阳光小路',
    date: '课后时光',
    location: '校园小路',
    image: '/photos/photo-002.jpg',
    description: '教学楼之间一条安静的步道，每一个平凡的午后，都开始变得值得铭记。',
    likes: 96,
    comments: 8,
  },
  {
    id: 'class-window',
    title: '教室窗边',
    date: '金色时光',
    location: '高三教室',
    image: '/photos/photo-003.jpg',
    description: '黄昏前的教室，柔和的光线、写了一半的笔记，和那些留在身后的声音。',
    likes: 143,
    comments: 19,
  },
  {
    id: 'sports-field',
    title: '操场时光',
    date: '星期五',
    location: '学校走廊',
    image: '/photos/photo-004.jpg',
    description: '铃声过后转瞬即逝的片刻，每个人都匆匆而行，回忆却在那一刻慢了下来。',
    likes: 87,
    comments: 6,
  },
  {
    id: 'memory-note',
    title: '回忆便签',
    date: '夏天将至',
    location: '自习室',
    image: '/photos/photo-005.jpg',
    description: '书桌、试卷，和那些未来触手可及的日子里，安静的专注。',
    likes: 112,
    comments: 10,
  },
  {
    id: 'mem-006',
    title: '午后光影',
    date: '高二那年',
    location: '图书馆',
    image: '/photos/photo-006.jpg',
    description: '透过窗洒进来的午后阳光，书页翻动的声音，和那个安静的下午。',
    likes: 76,
    comments: 5,
  },
  {
    id: 'mem-007',
    title: '雨后跑道',
    date: '春天',
    location: '操场',
    image: '/photos/photo-007.jpg',
    description: '雨后湿润的跑道，空气中弥漫着泥土和青草的味道。',
    likes: 91,
    comments: 7,
  },
  {
    id: 'mem-008',
    title: '天台晚霞',
    date: '毕业前夕',
    location: '教学楼天台',
    image: '/photos/photo-008.jpg',
    description: '站在天台看晚霞，三年的时光仿佛都凝聚在这片天空里。',
    likes: 156,
    comments: 22,
  },
  {
    id: 'mem-009',
    title: '食堂午后',
    date: '日常',
    location: '学生食堂',
    image: '/photos/photo-009.jpg',
    description: '午后的食堂安静下来，只有几个同学还在聊着天，笑着。',
    likes: 68,
    comments: 4,
  },
  {
    id: 'mem-010',
    title: '最后一课',
    date: '毕业那天',
    location: '高三教室',
    image: '/photos/photo-010.jpg',
    description: '最后一节课的铃声响起，没有人急着离开，都想多待一会儿。',
    likes: 201,
    comments: 28,
  },
];

if (import.meta.env.DEV && generatedMemories.length === 0) {
  console.info('请把照片放入 src/assets/memories 文件夹');
}

export const memories: Memory[] =
  generatedMemories.length > 0 ? generatedMemories : fallbackMemories;

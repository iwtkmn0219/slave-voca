# wordfreq(데이터 CC BY-SA 4.0)의 영어 빈도순 단어 중 알파벳 소문자 단어 20,000개를 한 줄에 하나씩 쓴다.
# 출처 표시는 data/frequency-NOTICE.md. 사용법: pip install wordfreq==3.1.1 후 npm run freq:build
import re
import sys

import wordfreq

sys.stdout.reconfigure(encoding='utf-8')

LIMIT = 20000
words = [w for w in wordfreq.top_n_list('en', LIMIT * 2) if re.fullmatch('[a-z]+', w)][:LIMIT]
if len(words) < LIMIT:
    sys.exit(f'wordfreq 단어가 모자랍니다: {len(words)}개')
with open(sys.argv[1], 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(words) + '\n')
print(f'{sys.argv[1]}: {len(words)}개 (wordfreq en)')

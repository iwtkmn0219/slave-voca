# data/frequency.json 출처와 라이선스

`data/frequency.json`은 [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1의 영어 단어 빈도 데이터에서 만든 파생 데이터다. 알파벳 소문자 단어 20,000개의 빈도 순위와, 그 원형의 순위가 들어 있다. 만드는 방법은 `scripts/export-wordfreq.py`, `scripts/build-frequency.ts`(`npm run freq:build`)에 있다.

- 라이선스: wordfreq 데이터와 이 파생 파일은 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)이다. 이 저장소의 코드(MIT)와는 따로 적용된다.
- wordfreq: Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437

wordfreq는 아래 자료를 바탕으로 한다. wordfreq의 요청에 따라 출처를 밝힌다.

- SUBTLEX(무료로 공개된 데이터이며, 작성자의 허락을 받아 wordfreq에 쓰였다)
  - Brysbaert, M. & New, B. (2009). Moving beyond Kucera and Francis: A Critical Evaluation of Current Word Frequency Norms and the Introduction of a New and Improved Word Frequency Measure for American English. Behavior Research Methods, 41(4), 977–990.
  - van Heuven, W. J., Mandera, P., Keuleers, E., & Brysbaert, M. (2014). SUBTLEX-UK: A new and improved word frequency database for British English. The Quarterly Journal of Experimental Psychology, 67(6), 1176–1190.
- Google Books Ngram Viewer(https://books.google.com/ngrams). Lin, Y., Michel, J.-B., Aiden, E. L., Orwant, J., Brockman, W., & Petrov, S. (2012). Syntactic annotations for the Google Books Ngram Corpus. Proceedings of the ACL 2012 System Demonstrations, 169–174.
- OpenSubtitles(https://www.opensubtitles.org). Lison, P. & Tiedemann, J. (2016). OpenSubtitles2016: Extracting Large Parallel Corpora from Movie and TV Subtitles. LREC 2016.
- 그 밖에 Wikipedia, Leeds Internet Corpus, ParaCrawl 등 CC 라이선스 자료와 Twitter 통계(내용은 재배포하지 않음). 전체 목록은 wordfreq README를 따른다.

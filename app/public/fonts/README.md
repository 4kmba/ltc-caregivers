# 글꼴

`PretendardVariable-subset.woff`는 [Pretendard](https://github.com/orioncactus/pretendard)(길형진, SIL Open Font License 1.1)를 줄인 파일입니다. 라이선스 전문은 `OFL.txt`에 있습니다.

원본 가변 글꼴(약 6.7MB)을 휴대폰에서 받기 좋게 약 370KB로 줄였습니다.

- 굵기는 400～700만 남겼습니다.
- 글자는 자주 쓰는 한글 2,350자(KS X 1001), 영문·숫자·문장 부호, `content/`와 `public/`, `src/`에 쓰인 글자만 남겼습니다.
- 여기에 없는 글자(드문 한글, 한자 등)는 시스템 글꼴로 보입니다.

내용 파일에 새 글자가 많이 늘면 다시 만듭니다. `fontTools`가 필요합니다(`pip install fonttools`).

```bash
python3 -m fontTools.varLib.instancer PretendardVariable.ttf wght=400:700 -o pre-limited.ttf
```

```bash
pyftsubset pre-limited.ttf --text-file=chars.txt --flavor=woff --layout-features='kern,liga,calt,locl,tnum,ccmp' --output-file=PretendardVariable-subset.woff
```

`chars.txt`에는 위에 적은 글자를 모아 넣습니다. `brotli`가 설치돼 있으면 `--flavor=woff2`로 더 작게 만들 수 있고, 그때는 `style.css`의 `@font-face` 경로와 형식도 함께 바꿉니다.

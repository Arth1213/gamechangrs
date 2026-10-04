# MiLC playoff opponent style source audit — 2026-10-04

Scope: public player styles only for the 113 exact opponent identities in the supplied playoff audit input. The browser research pass was read-only and imported no performance data from other seasons. Subsequent approved application is recorded in [the player-style audit](2026-10-04-playoff-player-style-sources.md#approved-application-and-verification).

## Results and limits

- 112/113 supplied exact profile URLs were opened and read in the CricClubs public MiLC site. Ishaan Unnithan (9432) has no supplied profile URL; no URL was guessed from his source ID.
- 107 batting styles and 79 bowling styles are unheld profile-listed claims. 28 opened profiles show a dash for bowling style, which remains unknown. Five identities are quarantined pending independent identity-linked corroboration.
- “Verified” means the exact supplied public profile and visible style claim were verified, not that the self-maintained profile fields were independently proven correct. Use `verifiedFields`, not record-level `verified`, to determine whether each field is available.
- Many profiles list the repeated combination “Right Hand Batter (Top Order)” / “Right Arm Medium.” This distribution is a data-quality risk: these may be default or stale fields. It is not evidence all those players actually bowl medium pace or bat top order.
- Quarantined potential defaults: Amila Aponso (8760), Chandrapaul Hemraj (8755), Kieran Powell (8791), Nosthush Kenjige (9021), and Tagenarine Chanderpaul (8792). These are suspicions, not independently established alternate-style claims; both fields are held conservatively. No alternate style was inferred from memory or name-only search results.
- Vraj Desai (8565), CC Player ID 4297066, is listed as right-hand top-order batter and left-arm orthodox on his [exact source profile](https://cricclubs.com/MiLC/user/zAm9qLC0TIcsiLpawz7Umw).

Durable machine-readable source ledger: [combined identity and style ledger](evidence/2026-10-04-playoff-style-profiles.json). It includes exact source URLs, field quotes, UTC retrieval timestamps, CC player IDs, verification flags, and unresolved notes. A dash is stored as null. Hyphenated source values are preserved rather than silently normalized.

## Profile-listed source claims

The exact supplied profile hash is the identity bridge; the visible profile name and CC Player ID were also recorded. Case-only capitalization differences are preserved. Source links below cite the visible public style labels. “Held” means neither field should be applied while unresolved.

| DB player ID | Exact public source / visible name | CC player ID | Batting label | Bowling label | Status | Retrieved UTC |
|---|---|---|---|---|---|---|
| 8753 | [Aadam Khan](https://cricclubs.com/MiLC/user/ktEmNBjC_ZeGzhY8S3avKA) | 2203087 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:26:52.240Z |
| 8592 | [Aaditva Agrawal](https://cricclubs.com/MiLC/user/OuvHzjuJhI5t-niW3FF8Xw) | 6212007 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:26:53.742Z |
| 8874 | [Aarin Nadkarni](https://cricclubs.com/MiLC/user/Av-wBFdWh3pu4xn3uUm9Pw) | 864320 | Right Handed Batter | Unknown (dash) | Profile-listed | 2026-10-04T19:26:54.810Z |
| 8801 | [Aaryan Boddupally](https://cricclubs.com/MiLC/user/HkTCpksZW38Vf0sPdGxfFQ) | 902848 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:26:56.116Z |
| 8550 | [Abdul Jabbar Mohammed](https://cricclubs.com/MiLC/user/vDf1aFdzB2Equ61uH4BlVg) | 1800727 | Right Hand Batter (Top Order) | Left Arm Orthodox | Profile-listed | 2026-10-04T19:26:57.267Z |
| 8758 | [Abdulahad Malek](https://cricclubs.com/MiLC/user/8WTfzZnDRzawnm1IAMzg9A) | 2686907 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:26:58.557Z |
| 8589 | [Abdullah Ghazi](https://cricclubs.com/MiLC/user/VaeHb6MU0hzMFpC4-MPnwA) | 494403 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:00.041Z |
| 8476 | [Abhiram Yeruva](https://cricclubs.com/MiLC/user/90Pvn_YxtJGkIKOBtJD8_w) | 5641727 | Right Hand Batter (Middle Order) | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:27:01.140Z |
| 9003 | [Abinav Sudershanum](https://cricclubs.com/MiLC/user/2civ4kn0SsclDYQHYFPP0Q) | 4377669 | Left Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:27:02.549Z |
| 8520 | [Adithya Ganesh](https://cricclubs.com/MiLC/user/lmP59wk58u4X3GFN_DKO6w) | 3557278 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:03.927Z |
| 8749 | [Aditya Padala](https://cricclubs.com/MiLC/user/J9uvDZHCHygFBhlZ3d2oCg) | 1767317 | Left Hand Batter (Top Order) | Left Arm Medium | Profile-listed | 2026-10-04T19:27:15.745Z |
| 8804 | [Advait Varadarajan](https://cricclubs.com/MiLC/user/K2IStz-7JnWLJQ7VAsQwYw) | 3480962 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:17.408Z |
| 8760 | [Amila Aponso](https://cricclubs.com/MiLC/user/YMinARZxcc3gxyAZZCB9uQ) | 2771685 | Right Hand Batter (Top Order) | Right Arm Medium | Held | 2026-10-04T19:27:18.614Z |
| 8858 | [Amshi De Silva](https://cricclubs.com/MiLC/user/fCaZpDnPFr2Z8Zf2ZXvErQ) | 4979800 | right-handed | right-arm-medium | Profile-listed | 2026-10-04T19:27:19.889Z |
| 8853 | [Andre Fletcher](https://cricclubs.com/MiLC/user/myHFFXdy3LwTbkqilTkOJg) | 7167896 | right-handed | right-arm-leg-spin | Profile-listed | 2026-10-04T19:27:20.965Z |
| 8513 | [Anirudh Emmanuel](https://cricclubs.com/MiLC/user/9D8oYF-6RlwA_87sX22hhQ) | 4418965 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:22.244Z |
| 8474 | [Ansh Rai](https://cricclubs.com/MiLC/user/Huo9ZORHuG1cL-QTwMJqzA) | 859146 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:27:23.996Z |
| 8562 | [Apurva Maheshram](https://cricclubs.com/MiLC/user/XUKDeVhX7wM8CCsiT1EYdw) | 2795119 | Right Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:27:25.311Z |
| 8762 | [Arya Garg](https://cricclubs.com/MiLC/user/fhJNyQ7ePOZYoiYhx5kNoQ) | 830461 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:27:26.471Z |
| 9006 | [Aryan Tummala](https://cricclubs.com/MiLC/user/ib_lW58YRxf0kL2_LYTiOA) | 1379843 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:27.808Z |
| 8551 | [Atharva Kaushal](https://cricclubs.com/MiLC/user/fYzFLtvY_2PCgMjnHUD6-g) | 6238057 | Left Hand Batter (Top Order) | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:27:28.926Z |
| 8782 | [Atish Gawand](https://cricclubs.com/MiLC/user/caCjtMYvRhJ9_XjMYSJ69w) | 1397591 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:30.299Z |
| 8878 | [Chaitanya Bishnoi](https://cricclubs.com/MiLC/user/ZEidPYOOxddvsZBEg9ZJbQ) | 3337647 | Left Handed Batter | Left Arm Off Spin | Profile-listed | 2026-10-04T19:27:31.850Z |
| 9224 | [Chaithanya Kumar Chava](https://cricclubs.com/MiLC/user/ZXmswDW1f3b3_xfdZwb9dg) | 602244 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:27:33.196Z |
| 8755 | [Chandrapaul Hemraj](https://cricclubs.com/MiLC/user/n6RZpe2XS1JdC5HQIo7PUg) | 3669914 | Right Hand Batter (Top Order) | Right Arm Medium | Held | 2026-10-04T19:27:34.576Z |
| 8748 | [Chinmay Kushare](https://cricclubs.com/MiLC/user/sjR-FPjfc7Sej3evxyuAQg) | 5006237 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:35.698Z |
| 8747 | [Christopher Van Tull](https://cricclubs.com/MiLC/user/v1iwn8gh-_nLtAjXr0nhhA) | 850385 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:36.947Z |
| 8564 | [Corne Dry](https://cricclubs.com/MiLC/user/7chUqWabdVGkHoS_YtLBrg) | 1968299 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:27:38.268Z |
| 8487 | [Danesh Patel](https://cricclubs.com/MiLC/user/KUdem8TPE9aGeqThqOnUZg) | 2623318 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:27:39.583Z |
| 9323 | [Dharshan Haribabu](https://cricclubs.com/MiLC/user/RfjM-y879DVv29EGPn14aQ) | 1804699 | Right Handed Batter | Right Arm Off Spin | Profile-listed | 2026-10-04T19:27:40.900Z |
| 9360 | [Dhruvan Kiran](https://cricclubs.com/MiLC/user/ymnEYmmdZ9tsPcZ_dMf2JA) | 1536380 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:35.922Z |
| 8449 | [Ekamnoor Sandhu](https://cricclubs.com/MiLC/user/h3kKMPEaGUr-ESSHj3r8_Q) | 7104137 | right-hand-batter-top-order | right-arm-fast | Profile-listed | 2026-10-04T19:28:37.801Z |
| 8856 | [Geeth Bolisetty](https://cricclubs.com/MiLC/user/shtEFLgZDD7reXUxiPEPkA) | 4909466 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:28:39.079Z |
| 8456 | [George Baldwin](https://cricclubs.com/MiLC/user/87Eh1rBqRKqxszDEFlKazA) | 4545895 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:40.332Z |
| 8986 | [Hamza Khalid](https://cricclubs.com/MiLC/user/d5y44oGWmrfXlp4FIWGFfg) | 1455082 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:28:41.616Z |
| 8802 | [Hardik Desai](https://cricclubs.com/MiLC/user/ZOTjE0MSvsu_1OtJN4mgEQ) | 1078503 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:43.177Z |
| 8754 | [Heath Richards](https://cricclubs.com/MiLC/user/Bv-3Whk_lcpQHIIf6Q73RA) | 2720743 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:44.388Z |
| 8857 | [Ian Chauhan](https://cricclubs.com/MiLC/user/6gnb4v20LJnkb56l9VK3wg) | 2233468 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:45.795Z |
| 8877 | [Imran Khan Jr](https://cricclubs.com/MiLC/user/jvIGMElebO6k7vv9PsQFcQ) | 3015032 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:47.929Z |
| 8446 | [Jacobus Pienaar](https://cricclubs.com/MiLC/user/6nqwtav2sjeUVX3HE7dgkg) | 2135700 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:49.146Z |
| 8765 | [Jagdish Narisetty](https://cricclubs.com/MiLC/user/vkD0v3DjdDiq9zhJjyginA) | 3347010 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:28:50.406Z |
| 8510 | [Jasdeep Singh](https://cricclubs.com/MiLC/user/ayKT68Hr_RSnjP4J88k02w) | 764639 | Right Hand Batter (Top Order) | Right Arm Fast | Profile-listed | 2026-10-04T19:28:52.071Z |
| 8523 | [Jaykishan Parwani](https://cricclubs.com/MiLC/user/IFmsgjDJv-lRW9cjvwJvaA) | 4545837 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:53.522Z |
| 9022 | [Joshua Kind](https://cricclubs.com/MiLC/user/INLxROgy4mD36tSz2PNRPA) | 480124 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:54.844Z |
| 9005 | [Joshua Tromp](https://cricclubs.com/MiLC/user/yzrgXHF96Zs_RGdwGtGXoA) | 2712958 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:28:55.985Z |
| 9248 | [Juanoy Drysdale](https://cricclubs.com/MiLC/user/iAtTULXiS4iPDxR27Lm7NA) | 2175576 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:28:57.066Z |
| 8873 | [Kamran Sheikh](https://cricclubs.com/MiLC/user/U0OoBPkFcevYP-__BQK8PA) | 654388 | Right Handed Batter | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:28:58.519Z |
| 9056 | [Kavin Govindaraju](https://cricclubs.com/MiLC/user/WRxFn5UGFo5JnaiPFfuuNA) | 1247778 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:28:59.963Z |
| 8596 | [Kevin Christian](https://cricclubs.com/MiLC/user/wGu_NhXjFJOm-ZBG2lxtEQ) | 3282902 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:29:01.583Z |
| 8791 | [Kieran Powell](https://cricclubs.com/MiLC/user/knnWxTLIrt2RDhT-naFmuA) | 2835019 | Right Hand Batter (Top Order) | Right Arm Medium | Held | 2026-10-04T19:29:02.744Z |
| 8524 | [Manoj Acharya](https://cricclubs.com/MiLC/user/vxdy_DIf0ABDTnTACMpMXg) | 2940500 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:30:46.052Z |
| 8750 | [Mario Rampersaud](https://cricclubs.com/MiLC/user/Zkm8YVg9XgG4vMxljOiiqg) | 1752218 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:30:47.306Z |
| 9012 | [Matthew Tromp](https://cricclubs.com/MiLC/user/v5UIsI96To91X0SXRxX5cw) | 2635676 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:30:48.563Z |
| 8751 | [Mohib Ahsan](https://cricclubs.com/MiLC/user/l0VQ2f-9FVBjX6aWAmAWzg) | 1788014 | Left Hand Batter (Top Order) | Left Arm Orthodox | Profile-listed | 2026-10-04T19:30:49.938Z |
| 8757 | [Monank Patel](https://cricclubs.com/MiLC/user/8y19gEAk2TpHOhvFBw41Hg) | 2175527 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:30:51.258Z |
| 8590 | [Muhammad Asad Ghous](https://cricclubs.com/MiLC/user/kAU0u6WaKWKNwf2yObU3Kw) | 2175593 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:30:52.354Z |
| 9024 | [Muhammad Waqas Saleem Saleem](https://cricclubs.com/MiLC/user/UHpSYTzQ3VXbzs3UInY1bQ) | 1808062 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:30:53.585Z |
| 8443 | [Mukhtar Ahmed](https://cricclubs.com/MiLC/user/cwZe_5mFU0NZfRj4agygvQ) | 3410403 | Right Handed Batter | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:30:54.917Z |
| 8879 | [Naqash Basharat](https://cricclubs.com/MiLC/user/4D8wrWYJet9ikXwyCet6eA) | 4246702 | Right Hand Batter (Top Order) | Left Arm Fast | Profile-listed | 2026-10-04T19:30:56.059Z |
| 8445 | [Nikhil Mudaliar](https://cricclubs.com/MiLC/user/B7APourPtOTkYIIsWDpkjw) | 1379971 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:30:58.467Z |
| 8888 | [Nitish Kumar](https://cricclubs.com/MiLC/user/M172NOJGHa7JxMBrfgtC8w) | 1371145 | Right Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:31:00.056Z |
| 9021 | [Nosthush Kenjige](https://cricclubs.com/MiLC/user/khs3CDqr0l5pskQWr6xxpQ) | 292747 | Right Handed Batter | Right Arm Medium | Held | 2026-10-04T19:31:01.450Z |
| 8812 | [Orrington Hamilton](https://cricclubs.com/MiLC/user/AR0KSJarikd33jEvN3VtCQ) | 3625786 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:31:02.881Z |
| 8763 | [Phani Simhadri](https://cricclubs.com/MiLC/user/G3MTHzgL4n7qH1ORIDmYsQ) | 842691 | Right Hand Batter (Top Order) | Left Arm Fast | Profile-listed | 2026-10-04T19:31:04.380Z |
| 8591 | [Pooranjay Yadav](https://cricclubs.com/MiLC/user/SIEscpkn_OmITt6bT3F4PA) | 5226549 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:31:06.468Z |
| 8805 | [Pranav Bhattad](https://cricclubs.com/MiLC/user/Iz1EENBgXBuHzPvktLNpEw) | 5224079 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:31:07.639Z |
| 9237 | [Pranav Reddy Pagydyala](https://cricclubs.com/MiLC/user/W3dy2XtefBFEq38Bit0guQ) | 2560688 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:31:08.897Z |
| 8860 | [Praneeth Raj Siddantham](https://cricclubs.com/MiLC/user/ezd9muYdkPUV5bMxjbdtUQ) | 3606769 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:31:10.218Z |
| 8637 | [Rajdeep Darbar](https://cricclubs.com/MiLC/user/GXVc_GR2W07zfP7gCVLkpA) | 2836513 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:31:11.418Z |
| 8746 | [Raunaq Sharma](https://cricclubs.com/MiLC/user/wKoJY11-1gbWa53HynoPrw) | 2101129 | Right Hand Batter (Top Order) | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:31:12.696Z |
| 8854 | [Rehman Dar](https://cricclubs.com/MiLC/user/rEkkTMjjrzXK1pB3dKvnlA) | 701010 | Left Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:43:46.236Z |
| 9026 | [Rishabh Shimpi](https://cricclubs.com/MiLC/user/ySIKAJyt3I4TwbvQfAVOuw) | 6785627 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:43:47.384Z |
| 9025 | [Rishi Ramesh](https://cricclubs.com/MiLC/user/OowlFMeIDaDVRnQFeX__gw) | 2176981 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:43:48.628Z |
| 8475 | [Ritvik Appidi](https://cricclubs.com/MiLC/user/BLDYMEdDjTqcsO09_ASzhw) | 1496421 | Right Hand Batter (Middle Order) | Right Arm Fast | Profile-listed | 2026-10-04T19:43:50.002Z |
| 8790 | [Romario King](https://cricclubs.com/MiLC/user/m7ku4r1FtaelnIJgvl4fEg) | 3480948 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:43:51.489Z |
| 8518 | [Ryan Scott](https://cricclubs.com/MiLC/user/1rKnVtyuGp4swyPbIflI_Q) | 497015 | Left Hand Batter (Top Order) | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:43:52.690Z |
| 8855 | [S Gowda](https://cricclubs.com/MiLC/user/ZSHmtNI0GUOTgQCWzNUPFg) | 1801149 | Right Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:43:53.872Z |
| 8512 | [Sachin Mylavarapu](https://cricclubs.com/MiLC/user/x4ORtmwYuESALRHGDDiz7Q) | 2175601 | Right Hand Batter (Top Order) | Left Arm Orthodox | Profile-listed | 2026-10-04T19:43:55.241Z |
| 8442 | [Saharsh Shwethan](https://cricclubs.com/MiLC/user/fOfF4QKipTaklyzW_0sn-w) | 1994612 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:43:56.704Z |
| 8761 | [Saif Badar](https://cricclubs.com/MiLC/user/4GKdZ1T6rWi5t8WeMbiVKQ) | 2591256 | Right Handed Batter | Right Arm Leg Spin | Profile-listed | 2026-10-04T19:43:58.398Z |
| 8636 | [Saiteja Mukkamalla](https://cricclubs.com/MiLC/user/Ux-jhc95j3WVMSUVotzEGg) | 1206339 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:43:59.831Z |
| 8561 | [Salman Shah](https://cricclubs.com/MiLC/user/H4P-xpHs5YJDThW1xmNgBw) | 6171959 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:01.083Z |
| 9365 | [Sanjit Sudhakar](https://cricclubs.com/MiLC/user/Eg7Ys0YkHVzjJ0k7zgC_Aw) | 6791495 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:02.455Z |
| 8522 | [Savir Kariveda](https://cricclubs.com/MiLC/user/M7hsJtXcYXWa68knVylECA) | 2090010 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:04.256Z |
| 8880 | [Shainiff Lalani](https://cricclubs.com/MiLC/user/kroKO4Ks8GSsAS6lcNbKEg) | 5789921 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:05.600Z |
| 8781 | [Shaurya Vanjari](https://cricclubs.com/MiLC/user/hpd1jb7BHtp49_9KNkE-Pg) | 2846321 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:06.989Z |
| 8621 | [Shazzad Hoqe](https://cricclubs.com/MiLC/user/I1pYigPhxfhmg_LFweZ0zQ) | 2613078 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:08.424Z |
| 8519 | [Shrey Sethi](https://cricclubs.com/MiLC/user/2U_THcIbdpuHJz0GIiOJCw) | 1799718 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:09.606Z |
| 8876 | [Shreyan Satheesh](https://cricclubs.com/MiLC/user/yhyI6ARW3FTd30i_GkSUwQ) | 1882314 | Right Handed Batter | Unknown (dash) | Profile-listed | 2026-10-04T19:44:10.992Z |
| 8803 | [Shuaib Syed](https://cricclubs.com/MiLC/user/XfzNnCehmHlfHWEhJKlDrg) | 2752328 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:12.401Z |
| 9324 | [Shubham Ranjane](https://cricclubs.com/MiLC/user/dnSLBFcshejJBoj6M94efA) | 5998774 | Right Handed Batter | Unknown (dash) | Profile-listed | 2026-10-04T19:44:25.230Z |
| 8866 | [Siddhant Shaah](https://cricclubs.com/MiLC/user/JcFgWd39z7ONzoqY_UPb_Q) | 810315 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:26.699Z |
| 8549 | [Sivaram Swarna](https://cricclubs.com/MiLC/user/eAH3EjzTqYm5WfR0qKrZ-Q) | 3480980 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:27.961Z |
| 8759 | [Soaeb Tai](https://cricclubs.com/MiLC/user/voLX86JshaHR9S7ruf0HBQ) | 4545579 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:29.413Z |
| 8447 | [Soham Agashe](https://cricclubs.com/MiLC/user/kDgSGuOm2w1pPKgK8y7hGA) | 2090549 | Right Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:44:30.770Z |
| 9446 | [Sohan Gudipati](https://cricclubs.com/MiLC/user/5pJjLEM6Z_N9S7H5F-UDfw) | 1536397 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:32.161Z |
| 8511 | [Stephen Wiig](https://cricclubs.com/MiLC/user/9-ECz2bjUpZZjKW0XdnofQ) | 831106 | Right Hand Batter (Top Order) | Left Arm Fast | Profile-listed | 2026-10-04T19:44:33.518Z |
| 9267 | [Sushant Modani](https://cricclubs.com/MiLC/user/KntwGAalKj-cLHSDkoqbHg) | 839135 | Right Hand Batter (Top Order) | Right Arm Off Spin | Profile-listed | 2026-10-04T19:44:34.988Z |
| 8875 | [Suvir Gudipati](https://cricclubs.com/MiLC/user/T5jxQm6-AgzV44H7ARpNAQ) | 1764055 | Right Handed Batter | Unknown (dash) | Profile-listed | 2026-10-04T19:44:36.371Z |
| 8488 | [Syed Ali Sher Kazmi](https://cricclubs.com/MiLC/user/ZB8cRmwUblmoFKoffAeobQ) | 5287299 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:37.707Z |
| 8792 | [Tagenarine Chanderpaul](https://cricclubs.com/MiLC/user/KwGI56TJh5Ebc7JvDs_O6Q) | 3557287 | Right Hand Batter (Top Order) | Right Arm Medium | Held | 2026-10-04T19:44:39.143Z |
| 9364 | [Tushar Gandepalli](https://cricclubs.com/MiLC/user/5jKQMC3Po3qQNbbZgf2Ujw) | 6670954 | left-hand-batter-middle-order | left-arm-fast | Profile-listed | 2026-10-04T19:44:40.337Z |
| 8887 | [Unmukt Chand](https://cricclubs.com/MiLC/user/JtACLt2y040V0vykn6bzgg) | 2205400 | Right Handed Batter | Right Arm Medium | Profile-listed | 2026-10-04T19:44:41.783Z |
| 9353 | [Vaibhav Suresh](https://cricclubs.com/MiLC/user/z5RD8yJWWbglhtf038HQCg) | 549887 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:43.873Z |
| 8444 | [Venkat Maheesh Kolahalam](https://cricclubs.com/MiLC/user/oYLWZmgCfioBgoZz2nmHIw) | 2182681 | Left Hand Batter (Top Order) | Left Arm Orthodox | Profile-listed | 2026-10-04T19:44:45.129Z |
| 8515 | [Vishal Onat](https://cricclubs.com/MiLC/user/OWptdMRj0QzSTiKExIFoMw) | 6894431 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:46.491Z |
| 8521 | [Vishal Reddy Thanugundla](https://cricclubs.com/MiLC/user/Yfs7WP-PesCqr3JBjPvzpQ) | 3233671 | Right Hand Batter (Top Order) | Left Arm Medium | Profile-listed | 2026-10-04T19:44:47.908Z |
| 8565 | [Vraj Desai](https://cricclubs.com/MiLC/user/zAm9qLC0TIcsiLpawz7Umw) | 4297066 | Right Hand Batter (Top Order) | Left Arm Orthodox | Profile-listed | 2026-10-04T19:44:49.828Z |
| 8859 | [Vrishin Kattari](https://cricclubs.com/MiLC/user/AVJC4BGAzKVZLhrUqT2IPg) | 1481570 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:51.024Z |
| 8563 | [Waleed Khan](https://cricclubs.com/MiLC/user/KIE-IEjeoaeAwHZxTyhGiw) | 2049564 | Right Hand Batter (Top Order) | Unknown (dash) | Profile-listed | 2026-10-04T19:44:52.419Z |
| 8560 | [Xavier Marshall](https://cricclubs.com/MiLC/user/H8WRXmV8zfBpKkjDdcurHA) | 2720808 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:53.977Z |
| 8865 | [Yuvan Kiran](https://cricclubs.com/MiLC/user/fBLYKoYqabCF54H-IpRoXQ) | 3627764 | Right Hand Batter (Top Order) | Right Arm Medium | Profile-listed | 2026-10-04T19:44:55.398Z |

## Unresolved no-URL identity

Ishaan Unnithan (9432) had no supplied profile URL. His public source ID is retained in the input, but was not transformed into a guessed URL. Batting and bowling styles remain unknown.

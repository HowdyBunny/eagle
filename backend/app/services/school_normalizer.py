"""
Lightweight school-name canonicalization.

Headhunter queries often involve a specific alma mater ("复旦本科","Stanford
PhD") — pure semantic embeddings collapse same-tier universities together
(清华 / 北大 / 复旦 → all "中国985"), so we keep a parallel canonical key on
each candidate for exact-match filtering.

This mapping is intentionally narrow: top Chinese universities, well-known
HK/SG schools, and a handful of US/UK names commonly seen in tech resumes.
Extend as needed — unknown schools simply return None and the filter falls
back to a string contains() match.
"""

from __future__ import annotations

# Order matters within an entry: longer aliases first so "上海交通大学" wins over "交大".
_SCHOOL_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    # ── Mainland China · C9 / Top 985 ────────────────────────────────────
    ("tsinghua",        ("清华大学", "清华", "Tsinghua")),
    ("peking",          ("北京大学", "北大", "Peking University", "PKU")),
    ("fudan",           ("复旦大学", "复旦", "Fudan")),
    ("sjtu",            ("上海交通大学", "上海交大", "交大", "SJTU", "Shanghai Jiao Tong")),
    ("zhejiang",        ("浙江大学", "浙大", "Zhejiang University", "ZJU")),
    ("nanjing",         ("南京大学", "南大", "Nanjing University")),
    ("ustc",            ("中国科学技术大学", "中科大", "科大", "USTC")),
    ("hit",             ("哈尔滨工业大学", "哈工大", "HIT")),
    ("xjtu",            ("西安交通大学", "西交大", "XJTU")),
    # ── Mainland China · Other top universities ──────────────────────────
    ("renmin",          ("中国人民大学", "人大", "Renmin University")),
    ("beihang",         ("北京航空航天大学", "北航", "Beihang")),
    ("bit",             ("北京理工大学", "北理工", "BIT")),
    ("tongji",          ("同济大学", "同济", "Tongji")),
    ("sysu",            ("中山大学", "中大", "SYSU", "Sun Yat-sen")),
    ("scut",            ("华南理工大学", "华工", "SCUT")),
    ("ecnu",            ("华东师范大学", "华师", "ECNU")),
    ("sufe",            ("上海财经大学", "上财", "SUFE")),
    ("ruc",             ("中国人民大学", "RUC")),
    # ── Hong Kong / Macau / Taiwan ───────────────────────────────────────
    ("hku",             ("香港大学", "港大", "HKU")),
    ("cuhk",            ("香港中文大学", "中大", "CUHK")),
    ("hkust",           ("香港科技大学", "港科大", "HKUST")),
    ("polyu",           ("香港理工大学", "理大", "PolyU")),
    ("cityu_hk",        ("香港城市大学", "城大", "CityU")),
    ("ntu_tw",          ("台湾大学", "台大", "National Taiwan University")),
    # ── Singapore ────────────────────────────────────────────────────────
    ("nus",             ("National University of Singapore", "NUS", "新加坡国立大学")),
    ("ntu_sg",          ("Nanyang Technological University", "NTU", "南洋理工大学")),
    ("smu",             ("Singapore Management University", "SMU", "新加坡管理大学")),
    # ── United States · Ivy + Tech ───────────────────────────────────────
    ("mit",             ("Massachusetts Institute of Technology", "MIT", "麻省理工")),
    ("stanford",        ("Stanford University", "Stanford", "斯坦福")),
    ("harvard",         ("Harvard University", "Harvard", "哈佛")),
    ("berkeley",        ("UC Berkeley", "Berkeley", "加州大学伯克利分校", "UCB")),
    ("ucla",            ("UCLA", "University of California Los Angeles")),
    ("cmu",             ("Carnegie Mellon", "CMU", "卡内基梅隆")),
    ("princeton",       ("Princeton University", "Princeton", "普林斯顿")),
    ("yale",            ("Yale University", "Yale", "耶鲁")),
    ("columbia",        ("Columbia University", "Columbia", "哥伦比亚")),
    ("cornell",         ("Cornell University", "Cornell", "康奈尔")),
    ("upenn",           ("University of Pennsylvania", "UPenn", "Penn", "宾夕法尼亚")),
    ("brown",           ("Brown University", "Brown")),
    ("uchicago",        ("University of Chicago", "UChicago", "芝加哥大学")),
    ("nyu",             ("New York University", "NYU", "纽约大学")),
    # ── UK / Europe ──────────────────────────────────────────────────────
    ("oxford",          ("University of Oxford", "Oxford", "牛津")),
    ("cambridge",       ("University of Cambridge", "Cambridge", "剑桥")),
    ("imperial",        ("Imperial College London", "Imperial", "帝国理工")),
    ("ucl",             ("University College London", "UCL", "伦敦大学学院")),
    ("lse",             ("London School of Economics", "LSE")),
    ("eth_zurich",      ("ETH Zurich", "苏黎世联邦理工")),
    # ── Tier hints for soft-matching ─────────────────────────────────────
    # Plain "985" or "211" in the resume — useful when school not in our map.
    ("tier_985",        ("985工程", "985院校", "985 高校")),
    ("tier_211",        ("211工程", "211院校", "211 高校")),
]


def is_known_school_slug(slug: str | None) -> bool:
    """Whether `slug` matches one of the canonical keys in our mapping."""
    if not slug:
        return False
    return any(s == slug for s, _ in _SCHOOL_ALIASES)


def canonicalize_school(education: str | None) -> str | None:
    """
    Return a canonical school slug if any known alias appears in the education
    string, else None. Matching is case-insensitive for ASCII and exact-substring
    for CJK — same heuristic the existing TA dedup logic uses.
    """
    if not education:
        return None
    haystack = education
    haystack_lower = education.lower()
    for slug, aliases in _SCHOOL_ALIASES:
        for alias in aliases:
            if alias.isascii():
                if alias.lower() in haystack_lower:
                    return slug
            else:
                if alias in haystack:
                    return slug
    return None

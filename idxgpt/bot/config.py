"""
Configuration file for BJB Sekuritas Telegram Bot
Contains all constants, API keys, database paths, and stock lists
"""

import os
from typing import Dict

# Bot Configuration
TOKEN = "7646822490:AAGJcZwQ79CoDmx-aP9ZZMdnBY2ce0-hdKk"

# Database Configuration
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "stock_data.db")
DB_PATH = "stock_data.db"
DB_NAME = "coins.db"
CMC_DATA_DB = "cmc.db"
Bjb_DB = "bjb.db"

# File Paths
TRANSACTIONS_FILE = "transactions.json"
LOG_FILE = "bot.log"
PDF_DIR = "./reports"

# API Keys
CMC_API_KEY = "bfa0ee26710e4abf8f721e4775f892c8"
NEWS_API_KEY = "bfa0ee26710e4abf8f721e4775f892c8"

# FastAPI Configuration
FASTAPI_APP = None  # Will be initialized in main.py

# Valid Tickers (for quick validation)
valid_tickers = {
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'UNVR', 'ASII', 'GGRM', 'HMSP', 'MEDC',
    'ADRO', 'ANTM', 'BRPT', 'CPIN', 'ICBP', 'INCO', 'INDF', 'KLBF', 'PGAS', 'PTBA',
    'SMGR', 'TBIG', 'TPIA', 'UNTR', 'WIKA'
}

# Sectors Mapping
SECTORS = {
    "energy": "Energi",
    "basic_materials": "Bahan Dasar",
    "industrials": "Industri",
    "consumer_non_cyclical": "Konsumen Non-Siklikal",
    "consumer_cyclical": "Konsumen Siklikal",
    "financials": "Keuangan",
    "healthcare": "Kesehatan",
    "technology": "Teknologi",
    "telecommunications": "Telekomunikasi",
    "utilities": "Utilitas",
}

# LQ45 Stocks
LQ45_STOCKS = {
    "ACES": "Aspirasi Hidup Indonesia Tbk.",
    "ADMR": "Adaro Minerals Indonesia Tbk.",
    "ADRO": "Adaro Energy Indonesia Tbk.",
    "AKRA": "AKR Corporindo Tbk.",
    "AMMN": "Amman Mineral Internasional Tbk.",
    "AMRT": "Sumber Alfaria Trijaya Tbk.",
    "ANTM": "Aneka Tambang Tbk.",
    "ARTO": "Bank Jago Tbk.",
    "ASII": "Astra International Tbk.",
    "BJBR": "Bank Central Asia Tbk.",
    "BBNI": "Bank Negara Indonesia (Persero) Tbk.",
    "BBRI": "Bank Rakyat Indonesia (Persero) Tbk.",
    "BBTN": "Bank Tabungan Negara (Persero) Tbk.",
    "BMRI": "Bank Mandiri (Persero) Tbk.",
    "BRIS": "Bank Syariah Indonesia Tbk.",
    "BRPT": "Barito Pacific Tbk.",
    "CPIN": "Charoen Pokphand Indonesia Tbk.",
    "CTRA": "Ciputra Development Tbk.",
    "ESSA": "Surya Esa Perkasa Tbk.",
    "EXCL": "XL Axiata Tbk.",
    "GOTO": "GoTo Gojek Tokopedia Tbk.",
    "ICBP": "Indofood CBP Sukses Makmur Tbk.",
    "INCO": "Vale Indonesia Tbk.",
    "INDF": "Indofood Sukses Makmur Tbk.",
    "INKP": "Indah Kiat Pulp & Paper Tbk.",
    "ISAT": "Indosat Tbk.",
    "ITMG": "Indo Tambangraya Megah Tbk.",
    "JPFA": "Japfa Comfeed Indonesia Tbk.",
    "JSMR": "Jasa Marga (Persero) Tbk.",
    "KLBF": "Kalbe Farma Tbk.",
    "MAPA": "Map Aktif Adiperkasa Tbk.",
    "MAPI": "Mitra Adiperkasa Tbk.",
    "MBMA": "Merdeka Battery Materials Tbk.",
    "MDKA": "Merdeka Copper Gold Tbk.",
    "MEDC": "Medco Energi Internasional Tbk.",
    "PGAS": "Perusahaan Gas Negara Tbk.",
    "PGEO": "Pertamina Geothermal Energy Tbk.",
    "PTBA": "Bukit Asam Tbk.",
    "SIDO": "Industri Jamu dan Farmasi Sido Muncul Tbk.",
    "SMGR": "Semen Indonesia (Persero) Tbk.",
    "SMRA": "Summarecon Agung Tbk.",
    "TLKM": "Telkom Indonesia (Persero) Tbk.",
    "TOWR": "Sarana Menara Nusantara Tbk.",
    "UNTR": "United Tractors Tbk.",
    "UNVR": "Unilever Indonesia Tbk."
}

# KOMPAS100 Stocks
KOMPAS100_STOCKS = {
    "ACES": "Aspirasi Hidup Indonesia Tbk.",
    "ADMR": "Adaro Minerals Indonesia Tbk.",
    "ADRO": "Adaro Energy Indonesia Tbk.",
    "AKRA": "AKR Corporindo Tbk.",
    "AMMN": "Amman Mineral Internasional Tbk.",
    "AMRT": "Sumber Alfaria Trijaya Tbk.",
    "ANTM": "Aneka Tambang Tbk.",
    "ARTO": "Bank Jago Tbk.",
    "ASII": "Astra International Tbk.",
    "AUTO": "Astra Otoparts Tbk.",
    "AVIA": "Avia Avian Tbk.",
    "BJBR": "Bank Central Asia Tbk.",
    "BBNI": "Bank Negara Indonesia (Persero) Tbk.",
    "BBRI": "Bank Rakyat Indonesia (Persero) Tbk.",
    "BBTN": "Bank Tabungan Negara (Persero) Tbk.",
    "BBYB": "Bank Neo Commerce Tbk.",
    "BDKR": "Berdikari Pondasi Perkasa Tbk.",
    "BFIN": "BFI Finance Indonesia Tbk.",
    "BMRI": "Bank Mandiri (Persero) Tbk.",
    "BMTR": "Global Mediacom Tbk.",
    "BNGA": "Bank CIMB Niaga Tbk.",
    "BRIS": "Bank Syariah Indonesia Tbk.",
    "BRMS": "Bumi Resources Minerals Tbk.",
    "BRPT": "Barito Pacific Tbk.",
    "BSDE": "Bumi Serpong Damai Tbk.",
    "BTPS": "Bank BTPN Syariah Tbk.",
    "CMRY": "Cisarua Mountain Dairy Tbk.",
    "CPIN": "Charoen Pokphand Indonesia Tbk.",
    "CTRA": "Ciputra Development Tbk.",
    "DEWA": "Dharma Henwa Tbk.",
    "DSNG": "Dharma Satya Nusantara Tbk.",
    "ELSA": "Elnusa Tbk.",
    "EMTK": "Emtek (SCTV) Tbk.",
    "ENRG": "Energi Mega Persada Tbk.",
    "ERAA": "Erajaya Swasembada Tbk.",
    "ESSA": "Surya Esa Perkasa Tbk.",
    "EXCL": "XL Axiata Tbk.",
    "FILM": "MD Pictures Tbk.",
    "GGRM": "Gudang Garam Tbk.",
    "GJTL": "Gajah Tunggal Tbk.",
    "GOTO": "GoTo Gojek Tokopedia Tbk.",
    "HEAL": "Medikaloka Hermina Tbk.",
    "HMSP": "HM Sampoerna Tbk.",
    "HRUM": "Harum Energy Tbk.",
    "ICBP": "Indofood CBP Sukses Makmur Tbk.",
    "INCO": "Vale Indonesia Tbk.",
    "INDF": "Indofood Sukses Makmur Tbk.",
    "INDY": "Indika Energy Tbk.",
    "INET": "Indointernet Tbk.",
    "INKP": "Indah Kiat Pulp & Paper Tbk.",
    "INTP": "Indocement Tunggal Prakarsa Tbk.",
    "ISAT": "Indosat Tbk.",
    "ITMG": "Indo Tambangraya Megah Tbk.",
    "JPFA": "Japfa Comfeed Indonesia Tbk.",
    "JSMR": "Jasa Marga (Persero) Tbk.",
    "KIJA": "Kawasan Industri Jababeka Tbk.",
    "KLBF": "Kalbe Farma Tbk.",
    "KPIG": "MNC Land Tbk.",
    "LSIP": "PP London Sumatra Indonesia Tbk.",
    "MAPA": "Map Aktif Adiperkasa Tbk.",
    "MAPI": "Mitra Adiperkasa Tbk.",
    "MARK": "Mark Dynamics Indonesia Tbk.",
    "MBMA": "Merdeka Battery Materials Tbk.",
    "MDKA": "Merdeka Copper Gold Tbk.",
    "MEDC": "Medco Energi Internasional Tbk.",
    "MIDI": "Midi Utama Indonesia Tbk.",
    "MIKA": "Mitra Keluarga Karyasehat Tbk.",
    "MNCN": "Media Nusantara Citra Tbk.",
    "MTEL": "Dayamitra Telekomunikasi Tbk.",
    "MYOR": "Mayora Indah Tbk.",
    "NCKL": "Trimegah Bangun Persada Tbk.",
    "NISP": "Bank OCBC NISP Tbk.",
    "PANI": "Pantai Indah Kapuk Dua Tbk.",
    "PGAS": "Perusahaan Gas Negara Tbk.",
    "PGEO": "Pertamina Geothermal Energy Tbk.",
    "PNLF": "Panin Financial Tbk.",
    "PTBA": "Bukit Asam Tbk.",
    "PTPP": "PP (Persero) Tbk.",
    "PTRO": "Petrosea Tbk.",
    "PWON": "Pakuwon Jati Tbk.",
    "RAJA": "Rukun Raharja Tbk.",
    "SCMA": "Surya Citra Media Tbk.",
    "SIDO": "Industri Jamu dan Farmasi Sido Muncul Tbk.",
    "SMGR": "Semen Indonesia (Persero) Tbk.",
    "SMIL": "Sarana Mitra Luas Tbk.",
    "SMRA": "Summarecon Agung Tbk.",
    "SRTG": "Saratoga Investama Sedaya Tbk.",
    "SSIA": "Surya Semesta Internusa Tbk.",
    "SSMS": "Sawit Sumbermas Sarana Tbk.",
    "SURI": "Surya Artha Nusantara Finance Tbk.",
    "TINS": "Timah Tbk.",
    "TKIM": "Pabrik Kertas Tjiwi Kimia Tbk.",
    "TLKM": "Telkom Indonesia (Persero) Tbk.",
    "TOBA": "TBS Energi Utama Tbk.",
    "TOWR": "Sarana Menara Nusantara Tbk.",
    "TPIA": "Chandra Asri Petrochemical Tbk.",
    "UNIQ": "Unggul Indah Cahaya Tbk.",
    "UNTR": "United Tractors Tbk.",
    "UNVR": "Unilever Indonesia Tbk.",
    "WIFI": "Solusi Sinergi Digital Tbk."
}

# JII70 Stocks
JII70_STOCKS = {
    "AALI": "Astra Agro Lestari Tbk.",
    "ACES": "Ace Hardware Indonesia Tbk.",
    "ADHI": "Adhi Karya (Persero) Tbk.",
    "ADRO": "Adaro Energy Tbk.",
    "AKRA": "AKR Corporindo Tbk.",
    "ANTM": "Aneka Tambang Tbk.",
    "ASII": "Astra International Tbk.",
    "ASRI": "Alam Sutera Realty Tbk.",
    "AUTO": "Astra Otoparts Tbk.",
    "BKSL": "Sentul City Tbk.",
    "BMTR": "Global Mediacom Tbk.",
    "BRIS": "Bank BRIsyariah Tbk.",
    "BRPT": "Barito Pacific Tbk.",
    "BSDE": "Bumi Serpong Damai Tbk.",
    "BTPS": "Bank Tabungan Pensiunan Nasional Syariah Tbk.",
    "BWPT": "Eagle High Plantations Tbk.",
    "CLEO": "Sariguna Primatirta Tbk.",
    "CPIN": "Charoen Pokphand Indonesia Tbk.",
    "CTRA": "Ciputra Development Tbk.",
    "DMAS": "Puradelta Lestari Tbk.",
    "ERAA": "Erajaya Swasembada Tbk.",
    "EXCL": "XL Axiata Tbk.",
    "GIAA": "Garuda Indonesia (Persero) Tbk.",
    "GMFI": "Garuda Maintenance Facility Aero Asia Tbk.",
    "HRUM": "Harum Energy Tbk.",
    "ICBP": "Indofood CBP Sukses Makmur Tbk.",
    "INCO": "Vale Indonesia Tbk.",
    "INDF": "Indofood Sukses Makmur Tbk.",
    "INDR": "Indo-Rama Synthetics Tbk.",
    "INDY": "Indika Energy Tbk.",
    "INTP": "Indocement Tunggal Prakarsa Tbk.",
    "ISAT": "Indosat Tbk.",
    "ITMG": "Indo Tambangraya Megah Tbk.",
    "JPFA": "Japfa Comfeed Indonesia Tbk.",
    "JSMR": "Jasa Marga (Persero) Tbk.",
    "KAEF": "Kimia Farma Tbk.",
    "KLBF": "Kalbe Farma Tbk.",
    "LINK": "Link Net Tbk.",
    "LPKR": "Lippo Karawaci Tbk.",
    "LPPF": "Matahari Department Store Tbk.",
    "LSIP": "PP London Sumatra Indonesia Tbk.",
    "MAPI": "Mitra Adiperkasa Tbk.",
    "MIKA": "Mitra Keluarga Karyasehat Tbk.",
    "MNCN": "Media Nusantara Citra Tbk.",
    "MPMX": "Mitra Pinasthika Mustika Tbk.",
    "MYOR": "Mayora Indah Tbk.",
    "MYRX": "Hanson International Tbk.",
    "PPRO": "PP Properti Tbk.",
    "PTBA": "Bukit Asam Tbk.",
    "PTPP": "PP (Persero) Tbk.",
    "PWON": "Pakuwon Jati Tbk.",
    "SCMA": "Surya Citra Media Tbk.",
    "SIDO": "Industri Jamu dan Farmasi Sido Muncul Tbk.",
    "SILO": "Siloam International Hospitals Tbk.",
    "SIMP": "Salim Ivomas Pratama Tbk.",
    "SMGR": "Semen Indonesia (Persero) Tbk.",
    "SMRA": "Summarecon Agung Tbk.",
    "TARA": "Sitara Propertindo Tbk.",
    "TCPI": "Transcoal Pacific Tbk.",
    "TINS": "Timah Tbk.",
    "TLKM": "Telekomunikasi Indonesia (Persero) Tbk.",
    "TOPS": "Totalindo Eka Persada Tbk.",
    "TPIA": "Chandra Asri Petrochemical Tbk.",
    "UNTR": "United Tractors Tbk.",
    "UNVR": "Unilever Indonesia Tbk.",
    "WIKA": "Wijaya Karya (Persero) Tbk.",
    "WOOD": "Integra Indocabinet Tbk.",
    "WSBP": "Waskita Beton Precast Tbk.",
    "WTON": "Wijaya Karya Beton Tbk.",
    "ZINC": "Kapuas Prima Coal Tbk."
}

# MBX Stocks
MBX_STOCKS = {
    "AADI": "", "AALI": "", "ABMM": "", "ACES": "", "ADHI": "", "ADMR": "", "ADRO": "", "AGRO": "", "AISA": "",
    "AKRA": "", "ALII": "", "AMFG": "", "AMMN": "", "AMRT": "", "ANTM": "", "APLN": "", "ARNA": "", "ARTO": "",
    "ASGR": "", "ASII": "", "ASRI": "", "ASSA": "", "AUTO": "", "AVIA": "", "BACA": "", "BALI": "", "BJBR": "",
    "BBHI": "", "BBKP": "", "BBNI": "", "BBRI": "", "BBTN": "", "BBYB": "", "BCAP": "", "BDKR": "", "BDMN": "",
    "BELI": "", "BEST": "", "BFIN": "", "BINA": "", "BIRD": "", "BISI": "", "BJBR": "", "BJTM": "", "BLES": "",
    "BMHS": "", "BMRI": "", "BMTR": "", "BNGA": "", "BNII": "", "BOLA": "", "BREN": "", "BRIS": "", "BRMS": "",
    "BRPT": "", "BSBK": "", "BSDE": "", "BSIM": "", "BTPN": "", "BTPS": "", "BUDI": "", "BUKA": "", "BUMI": "",
    "BVIC": "", "BWPT": "", "BYAN": "", "CARS": "", "CASS": "", "CBDK": "", "CFIN": "", "CLEO": "", "CMNP": "",
    "CMRY": "", "CNMA": "", "CPIN": "", "CSRA": "", "CTRA": "", "CUAN": "", "DAAZ": "", "DEWA": "", "DGWG": "",
    "DILD": "", "DLTA": "", "DMAS": "", "DOID": "", "DRMA": "", "DSNG": "", "DSSA": "", "ELPI": "", "ELSA": "",
    "EMTK": "", "ENRG": "", "ERAA": "", "ERAL": "", "ESSA": "", "EXCL": "", "FILM": "", "GEMS": "", "GGRM": "",
    "GJTL": "", "GOLF": "", "GOOD": "", "GOTO": "", "HATM": "", "HEAL": "", "HEXA": "", "HILL": "", "HITS": "",
    "HOKI": "", "HRTA": "", "HRUM": "", "ICBP": "", "IMAS": "", "IMPC": "", "INCO": "", "INDF": "", "INDY": "",
    "INKP": "", "INPC": "", "INTP": "", "IPCC": "", "ISAT": "", "ISSP": "", "ITMG": "", "JARR": "", "JKON": "",
    "JPFA": "", "JSMR": "", "JTPE": "", "KBLI": "", "KEEN": "", "KIJA": "", "KKGI": "", "KLBF": "", "KSIX": "",
    "LION": "", "LPCK": "", "LPKR": "", "LPPF": "", "LSIP": "", "LTLS": "", "MAHA": "", "MAIN": "", "MAPA": "",
    "MAPI": "", "MARK": "", "MAYA": "", "MBSS": "", "MCAS": "", "MCOL": "", "MCOR": "", "MDIY": "", "MDKA": "",
    "MDLN": "", "MEDC": "", "MEGA": "", "MFIN": "", "MIDI": "", "MIKA": "", "MKTR": "", "MLBI": "", "MLIA": "",
    "MLPL": "", "MMLP": "", "MNCN": "", "MORA": "", "MPMX": "", "MPPA": "", "MSIN": "", "MSJA": "", "MSTI": "",
    "MTDL": "", "MTEL": "", "MTLA": "", "MTMH": "", "MYOH": "", "MYOR": "", "NCKL": "", "NISP": "", "OMED": "",
    "PANR": "", "PANS": "", "PBID": "", "PGAS": "", "PGEO": "", "PNBN": "", "PNIN": "", "PNLF": "", "POWR": "",
    "PRDA": "", "PSGO": "", "PSSI": "", "PTBA": "", "PTPP": "", "PTRO": "", "PWON": "", "RAAM": "", "RAJA": "",
    "RALS": "", "RMKE": "", "SAME": "", "SAMF": "", "SCMA": "", "SGRO": "", "SHIP": "", "SIDO": "", "SILO": "",
    "SIMP": "", "SMBR": "", "SMDR": "", "SMGR": "", "SMIL": "", "SMMA": "", "SMRA": "", "SMSM": "", "SOCI": "",
    "SPTO": "", "SRAJ": "", "SRTG": "", "SSIA": "", "SSMS": "", "STAA": "", "SUNI": "", "TAPG": "", "TBIG": "",
    "TBLA": "", "TEBE": "", "TINS": "", "TKIM": "", "TLKM": "", "TMAS": "", "TOBA": "", "TOTL": "", "TOWR": "",
    "TPMA": "", "TRGU": "", "TRIM": "", "TSPC": "", "TUGU": "", "UCID": "", "ULTJ": "", "UNIC": "", "UNIQ": "",
    "UNTR": "", "UNVR": "", "VICI": "", "VTNY": "", "WEGE": "", "WIIM": "", "WINS": "", "WOOD": "", "WTON": ""
}

# ISSI Stocks
ISSI_STOCKS = {
    "AADI": "", "AALI": "", "ACES": "", "ACRO": "", "ACST": "", "ADCP": "", "ADES": "", "ADHI": "", "ADMG": "",
    "ADMR": "", "ADRO": "", "AGAR": "", "AGII": "", "AIMS": "", "AISA": "", "AKKU": "", "AKPI": "", "AKRA": "",
    "AKSI": "", "ALDO": "", "AMAN": "", "AMFG": "", "AMIN": "", "AMMN": "", "ANDI": "", "ANJT": "", "ANTM": "",
    "APII": "", "APLI": "", "APLN": "", "ARCI": "", "AREA": "", "ARGO": "", "ARII": "", "ARNA": "", "ARTA": "",
    "ASGR": "", "ASHA": "", "ASII": "", "ASLC": "", "ASLI": "", "ASPI": "", "ASRI": "", "ATAP": "", "ATIC": "",
    "ATLA": "", "AUTO": "", "AVIA": "", "AWAN": "", "AXIO": "", "AYAM": "", "AYLS": "", "BABY": "", "BAIK": "",
    "BALI": "", "BANK": "", "BAPA": "", "BAPI": "", "BATA": "", "BATR": "", "BAUT": "", "BAYU": "", "BBRM": "",
    "BBSS": "", "BCIP": "", "BEBS": "", "BEEF": "", "BELI": "", "BELL": "", "BESS": "", "BEST": "", "BIKA": "",
    "BIKE": "", "BINO": "", "BIPP": "", "BIRD": "", "BISI": "", "BKDP": "", "BKSL": "", "BLES": "", "BLTA": "",
    "BLTZ": "", "BLUE": "", "BMHS": "", "BMSR": "", "BMTR": "", "BNBR": "", "BOBA": "", "BOGA": "", "BOLA": "",
    "BOLT": "", "BRAM": "", "BRIS": "", "BRMS": "", "BRRC": "", "BSBK": "", "BSDE": "", "BSML": "", "BSSR": "",
    "BTON": "", "BTPS": "", "BUAH": "", "BUDI": "", "BUKK": "", "BULL": "", "BUMI": "", "BUVA": "", "BYAN": "",
    "CAKK": "", "CAMP": "", "CANI": "", "CARE": "", "CASS": "", "CBDK": "", "CBPE": "", "CBRE": "", "CCSI": "",
    "CEKA": "", "CGAS": "", "CHEM": "", "CINT": "", "CITA": "", "CITY": "", "CLEO": "", "CLPI": "", "CMNP": "",
    "CMPP": "", "CMRY": "", "CNMA": "", "COAL": "", "CPIN": "", "CPRO": "", "CRAB": "", "CRSN": "", "CSAP": "",
    "CSIS": "", "CSMI": "", "CSRA": "", "CTBN": "", "CTRA": "", "CYBR": "", "DAAZ": "", "DADA": "", "DATA": "",
    "DAYA": "", "DCII": "", "DEPO": "", "DEWA": "", "DEWI": "", "DGIK": "", "DGNS": "", "DGWG": "", "DILD": "",
    "DIVA": "", "DKFT": "", "DMAS": "", "DMMX": "", "DMND": "", "DOOH": "", "DRMA": "", "DSFI": "", "DSNG": "",
    "DSSA": "", "DUTI": "", "DVLA": "", "DWGL": "", "DYAN": "", "EAST": "", "ECII": "", "EDGE": "", "EKAD": "",
    "ELIT": "", "ELPI": "", "ELSA": "", "ELTY": "", "EMDE": "", "EMTK": "", "ENAK": "", "ENRG": "", "ENZO": "",
    "EPAC": "", "EPMT": "", "ERAA": "", "ERAL": "", "ESIP": "", "ESSA": "", "ESTA": "", "EXCL": "", "FAPA": "",
    "FAST": "", "FILM": "", "FIRE": "", "FISH": "", "FITT": "", "FMII": "", "FOLK": "", "FOOD": "", "FORU": "",
    "FPNI": "", "FREN": "", "FUTR": "", "FWCT": "", "GDST": "", "GDYR": "", "GEMA": "", "GEMS": "", "GGRP": "",
    "GHON": "", "GIAA": "", "GJTL": "", "GLVA": "", "GMTD": "", "GOLD": "", "GOLF": "", "GOOD": "", "GPRA": "",
    "GPSO": "", "GRIA": "", "GRPH": "", "GTBO": "", "GTRA": "", "GTSI": "", "GULA": "", "GUNA": "", "GWSA": "",
    "GZCO": "", "HADE": "", "HAIS": "", "HALO": "", "HATM": "", "HDIT": "", "HEAL": "", "HERO": "", "HEXA": "",
    "HGII": "", "HILL": "", "HITS": "", "HOKI": "", "HOMI": "", "HOPE": "", "HRME": "", "HRUM": "", "HUMI": "",
    "HYGN": "", "IATA": "", "IBST": "", "ICBP": "", "ICON": "", "IDPR": "", "IFII": "", "IFSH": "", "IGAR": "",
    "IIKP": "", "IKAI": "", "IKAN": "", "IKBI": "", "IKPM": "", "IMPC": "", "INCI": "", "INCO": "", "INDF": "",
    "INDR": "", "INDS": "", "INDX": "", "MDIY": "", "MDKA": "", "MDKI": "", "MEDC": "", "MEDS": "", "MERK": "",
    "META": "", "MFMI": "", "MGNA": "", "MHKI": "", "MICE": "", "MIKA": "", "MINA": "", "MIRA": "", "MITI": "",
    "MKAP": "", "MKPI": "", "MKTR": "", "MLIA": "", "MLPL": "", "MLPT": "", "MMIX": "", "MMLP": "", "MNCN": "",
    "MORA": "", "MPIX": "", "MPMX": "", "MPOW": "", "MPPA": "", "MPRO": "", "MPXL": "", "MRAT": "", "MSIN": "",
    "MSJA": "", "MSKY": "", "MSTI": "", "MTDL": "", "MTEL": "", "MTFN": "", "MTLA": "", "MTMH": "", "MTSM": "",
    "MUTU": "", "MYOH": "", "MYOR": "", "NAIK": "", "NASA": "", "NASI": "", "NCKL": "", "NELY": "", "NFCX": "",
    "NICE": "", "NICL": "", "NPGF": "", "NRCA": "", "NTBK": "", "NZIA": "", "OASA": "", "OBAT": "", "OBMD": "",
    "OILS": "", "OKAS": "", "OMED": "", "OMRE": "", "OPMS": "", "PADA": "", "PALM": "", "PAMG": "", "PANI": "",
    "PANR": "", "PBID": "", "PBSA": "", "PCAR": "", "PDPP": "", "PEHA": "", "PEVE": "", "PGAS": "", "PGEO": "",
    "PGLI": "", "PGUN": "", "PICO": "", "PIPA": "", "PJAA": "", "PKPK": "", "PLIN": "", "PMJS": "", "PNBS": "",
    "PNGO": "", "PNSE": "", "POLI": "", "POLU": "", "PORT": "", "POWR": "", "PPRE": "", "PPRI": "", "PRAY": "",
    "PRDA": "", "PRIM": "", "PSAB": "", "PSDN": "", "PSGO": "", "PSKT": "", "PSSI": "", "PTBA": "", "PTIS": "",
    "PTMP": "", "PTMR": "", "PTPP": "", "PTPS": "", "PTPW": "", "PTRO": "", "PTSN": "", "PTSP": "", "PURA": "",
    "PURI": "", "PWON": "", "PZZA": "", "RAAM": "", "RAFI": "", "RAJA": "", "RALS": "", "RANC": "", "RBMS": "",
    "RDTX": "", "REAL": "", "RGAS": "", "RIGS": "", "RISE": "", "RMKE": "", "RMKO": "", "ROCK": "", "RODA": "",
    "RONY": "", "ROTI": "", "RSCH": "", "RSGK": "", "RUIS": "", "SAFE": "", "SAGE": "", "SAME": "", "SAMF": "",
    "SAPX": "", "SATU": "", "SBMA": "", "SCCO": "", "SCMA": "", "SCNP": "", "SCPI": "", "SDMU": "", "SEMA": "",
    "SGER": "", "SGRO": "", "SHID": "", "SICO": "", "SIDO": "", "SILO": "", "SIMP": "", "SIPD": "", "SKBM": "",
    "SKLT": "", "SKRN": "", "SLIS": "", "SMAR": "", "SMBR": "", "SMCB": "", "SMDM": "", "SMDR": "", "SMGA": "",
    "SMGR": "", "SMIL": "", "SMKL": "", "SMLE": "", "SMMT": "", "SMRA": "", "SMSM": "", "SNLK": "", "SOCI": "",
    "SOHO": "", "SOLA": "", "SONA": "", "SOSS": "", "SOTS": "", "SPMA": "", "SPTO": "", "SRAJ": "", "SRTG": "",
    "SSIA": "", "SSTM": "", "STAA": "", "STTP": "", "SULI": "", "SUNI": "", "SUPR": "", "SURI": "", "SWID": "",
    "TALF": "", "TAMA": "", "TAMU": "", "TAPG": "", "TARA": "", "TAXI": "", "TBMS": "", "TCID": "", "TCPI": "",
    "TEBE": "", "TFAS": "", "TFCO": "", "TGKA": "", "TGUK": "", "TINS": "", "TIRA": "", "TIRT": "", "TKIM": "",
    "TLDN": "", "TLKM": "", "TMAS": "", "TMPO": "", "TNCA": "", "TOBA": "", "TOOL": "", "TOPS": "", "TOSK": "",
    "TOTL": "", "TOTO": "", "TPIA": "", "TPMA": "", "TRIS": "", "TRON": "", "TRST": "", "TRUE": "", "TRUK": "",
    "TSPC": "", "TYRE": "", "UANG": "", "UCID": "", "UFOE": "", "ULTJ": "", "UNIC": "", "UNIQ": "", "UNTD": "",
    "UNTR": "", "UNVR": "", "UVCR": "", "VAST": "", "VERN": "", "VICI": "", "VISI": "", "VKTR": "", "VOKS": "",
    "WAPO": "", "WEGE": "", "WEHA": "", "WIFI": "", "WINR": "", "WINS": "", "WIRG": "", "WMUU": "", "WOOD": "",
    "WOWS": "", "WTON": "", "YELO": "", "YPAS": "", "ZATA": "", "ZBRA": "", "ZONE": "", "ZYRX": ""
}

# Index Stocks Mapping
INDEX_STOCKS = {
    "LQ45": LQ45_STOCKS,
    "JII70": JII70_STOCKS,
    "KOMPAS100": KOMPAS100_STOCKS,
    "MBX": MBX_STOCKS,
    "ISSI": ISSI_STOCKS
}

# Indices (lowercase keys)
INDICES = {
    "lq45": LQ45_STOCKS,
    "jii70": JII70_STOCKS,
    "kompas100": KOMPAS100_STOCKS,
    "mbx": MBX_STOCKS,
    "issi": ISSI_STOCKS,
}

# Global Variables
is_updating = False
DB_CONNECTION = None  # Will be initialized in db_utils.py

# Motivational Messages
MOTIVATIONS = [
    "Hari ini adalah kesempatan baru untuk belajar strategi trading dan meraih profit! 💪",
    "Investasi cerdas dimulai dari langkah kecil. Yuk, pelajari pasar dan wujudkan tujuan finansialmu! 📈",
    "Jangan takut mencoba! Setiap praktik trading membawamu lebih dekat ke kesuksesan. 🚀",
    "Pasar selalu penuh peluang. Asah ilmu investasimu dan raih potensi maksimal! 🌟"
]

# Default Settings
DEFAULT_BALANCE = 100000000.0  # Rp100 juta
CACHE_DURATION_MINUTES = 5
MAX_ACCESS_COUNT = 3
MAX_MESSAGE_LENGTH = 4096

# Keterangan Mapping for PDF Processing
KETERANGAN_MAPPING = {
    "PENGHASILAN": "PENGHASILAN",
    "PENGHASILAN USAHA": "PENGHASILAN USAHA",
    "KOMISI PERNIARAAN PERDAGANGAN EFEK": "KOMISI PERANTARA PERDAGANGAN EFEK",
    "Komisi Pemasaran Pemasangan Efek": "KOMISI PERANTARA PERDAGANGAN EFEK",
    "Komisi Transaksi Efek Rekondisian": "KOMISI PERANTARA PERDAGANGAN EFEK",
    "Pendapatan Bunga Nasabah Reguler": "Pendapatan Bunga Nasabah Reguler",
    "DIVIDEN DAN BUNGA KUUPN PORTOFOLIO": "DIVIDEN DAN BUNGA KUPON PORTOFOLIO EFEK",
    "Bunga Kuupn Obligasi atas Sukuk Korposensi": "Bunga Kupon Obligasi atau Sukuk Korporasi",
    "Dividen Efek Bersih": "Dividen Efek Bersifat Ekuitas",
    "Pendapatan Bunga Efek PORTOFOLIO EFEK": "PENJUALAN PORTOFOLIO EFEK",
    "Jaba (Rugi) Pengeluaran Efek Bersihai Bualbes": "Laba (Rugi) Penjualan Efek Bersifat Ekuitas",
    "BUNGA OBLIGASI": "BUNGA DEPOSITO DAN JASA GIRO",
    "BUNGA OBLIGASI IDR": "Bunga Deposito IDR",
    "Bunga Jasa Efek Bank IDR": "Bunga Jasa Giro Bank IDR",
    "PENGHASILAN NON USAHA": "PENGHASILAN NON USAHA",
    "SELISIH HARGA DAN KURS VALUTA ASING": "SELISIH HARGA DAN KURS VALUTA ASING",
    "PENDAPATAN LAIN-LAIN": "PENDAPATAN LAIN-LAIN",
    "Pencatatan Lain-Lain": "PENDAPATAN LAIN-LAIN",
    "TOTAL INCOMES": "TOTAL INCOMES",
    "BIAYA": "BIAYA",
    "BIAYA OPERASIONAL": "BIAYA OPERASIONAL",
    "BTK - Gaji dan Upah - Imbalan Kerja": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK - Gaji dan Upah - Tunjangan PHT 21": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK - Gaji dan Upah - PBTs Kesehatan": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK - Gaji dan Upah - Upah All THT": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK - Gaji dan Upah - Tunjangan Kendaraan": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK Lainnya - Tunjangan Hari Raya": "BTK Lainnya - Tunjangan Hari Raya",
    "BTK Lainnya - Tunjangan Pegajaran Dinas": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BTK Lainnya - Tunj Gang": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BTK Lainnya - Uang Pakai Dinas Pegawai": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BTK Lainnya - Asuransi Kecelakaan": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BTK Lainnya - Fasilitas Telekomunikasi": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BTK - Gaji dan Upah - Outsourang": "BTK - Gaji dan Upah - Imbalan Kerja",
    "BTK Lainnya - Uang Sakai Belakang": "BTK Lainnya - Uang Saku Perjalanan Dinas",
    "BIAYA TRANSAKSI EFEK": "BIAYA TRANSAKSI EFEK",
    "Biaya Transaksi Efek IDX": "Biaya Transaksi Efek IDX",
    "Biaya Pajak Perusahaan Efek Transaksi Efek KPEI": "Biaya Kliring Penyelesaian Transaksi Efek KPEI",
    "Biaya Pajak Perusahaan Efek IDX": "Biaya Pajak Penjualan Efek IDX",
    "Biaya Pajak Perusahaan Efek Transfer Efek KSEI": "Biaya Penyimpanan dan Transfer Efek KSEI",
    "Biaya Transfer Bank": "Biaya Transfer Bank",
    "Biaya Komisi Transaksi Efek Perusahaan Efek Lain": "Biaya Komisi Transaksi Efek Perusahaan Efek Lain",
    "Biaya Komisi Transfer Efek": "Biaya Komisi Transaksi Efek Perusahaan Efek Lain",
    "Biaya Sharing Revenue IDXSTI": "Beban bagi hasil - IDXSTI",
    "BIAYA OPERASIONAL LAINNYA": "BIAYA OPERASIONAL LAINNYA",
    "BIAYA PENGEMBALAN SUM": "BIAYA PENGEMBANGAN SDM"
}

# Global currencies for major currencies
MAJOR_CURRENCIES = {
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "USDJPY=X",
    "USD/CAD": "USDCAD=X",
    "USD/CHF": "USDCHF=X",
    "USD/IDR": "IDR=X",
    "USD/CNY": "CNY=X",
    "USD/RUB": "RUB=X",
    "USD/AUD": "AUDUSD=X",
    "USD/INR": "INR=X",
}

# Commodities for commodity prices
COMMODITIES = {
    "Gold": "GC=F",
    "Silver": "SI=F",
    "Copper": "HG=F",
    "Crude Oil WTI": "CL=F",
    "Brent Crude": "BZ=F",
    "Natural Gas": "NG=F",
    "Coal": "MTF=F",
    "Aluminium": "ALI=F",
    "Platinum": "PL=F",
    "Palladium": "PA=F",
    "Corn": "ZC=F",
    "Wheat": "ZW=F",
    "Soybeans": "ZS=F",
    "Sugar": "SB=F",
    "Cotton": "CT=F",
}

# Global indices for global market data
GLOBAL_INDICES = {
    "Dow Jones": "^DJI",
    "NASDAQ": "^IXIC",
    "S&P 500": "^GSPC",
    "IHSG": "^JKSE",
    "FTSE 100 (Inggris)": "^FTSE",
    "Nikkei": "^N225",
    "KOSPI (Korea)": "^KS11",
    "Shanghai (China)": "000001.SS",
    "BSE Sensex (India)": "^BSESN",
    "DAX (Jerman)": "^GDAXI",
}

# Admin Configuration
ADMIN_IDS = [241390483]

# Logging Configuration
LOG_CONFIG = {
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'level': 'INFO',
    'handlers': ['file', 'console']
}
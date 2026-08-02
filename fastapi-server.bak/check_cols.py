from sqlalchemy import create_engine, inspect
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
columns = inspect(engine).get_columns('index_daily')
print('index_daily cols:', [c['name'] for c in columns])

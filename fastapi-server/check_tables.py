from sqlalchemy import create_engine, inspect
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
inspector = inspect(engine)
print('Tables in broker_db:', inspector.get_table_names())

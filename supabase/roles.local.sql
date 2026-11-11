\getenv db_password POSTGRES_PASSWORD
alter role authenticator with password :'db_password';

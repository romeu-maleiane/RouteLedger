# MongoDB Atlas setup

The Django API reads its database connection from `MONGO_URI`. In development and deployment, provide an Atlas SRV connection string rather than committing it to source control.

## Atlas configuration

1. Create a free Atlas cluster and a database user with read/write access.
2. Add the deployed backend host to Atlas Network Access. During local development, add only your current IP address.
3. Copy the Atlas Driver connection string and replace its username, password, cluster URL, and database name.
4. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI`.

Example shape:

```text
mongodb+srv://planner_user:<password>@cluster0.example.mongodb.net/hos_trip_planner?retryWrites=true&w=majority
```

## Deployment variables

Set these environment variables in the Django hosting provider:

```text
MONGO_URI=<your Atlas connection string>
MONGO_DATABASE=hos_trip_planner
DJANGO_SECRET_KEY=<long random secret>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=<backend hostname>
CORS_ALLOWED_ORIGINS=<frontend origin>
```

The backend reuses a PyMongo client per process and keeps credentials outside the repository.

This is the exact pattern used in real enterprise environments:

* Frontend container → serves UI
* Backend container → exposes APIs
* Database container → stores data
* Kubernetes → orchestrates everything

If you understand this model properly, you understand:

* Microservices basics
* Container networking
* Service discovery
* Internal vs external ports
* Kubernetes deployments and services
* DevOps deployment workflow

This lab intentionally keeps the application simple while enabling production-grade architecture concepts.

---

# Architecture


Browser
   |
   v
Frontend Container (NGINX)
   |
   v
Backend API Container (Node.js)
   |
   v
MongoDB Container


Kubernetes communication:


Frontend Pod ---> Backend Service ---> Backend Pod
Backend Pod ---> MongoDB Service ---> MongoDB Pod


---

# Project Structure


fullstack-k8s-demo/
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── k8s/
│   ├── mongodb-deployment.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   └── ingress-or-nodeport.yaml
│
└── README.md


---

# STEP 1 — FRONTEND APPLICATION

## frontend/index.html

html
<!DOCTYPE html>
<html>
<head>
    <title>Kubernetes Full Stack Demo</title>
    <style>
        body {
            font-family: Arial;
            background: #f4f4f4;
            text-align: center;
            margin-top: 100px;
        }

        .box {
            background: white;
            padding: 30px;
            width: 400px;
            margin: auto;
            border-radius: 10px;
            box-shadow: 0px 0px 10px gray;
        }

        input {
            padding: 10px;
            width: 80%;
        }

        button {
            padding: 10px;
            margin-top: 10px;
            cursor: pointer;
        }
    </style>
</head>
<body>

<div class="box">
    <h1>K8s Demo Application</h1>

    <input type="text" id="message" placeholder="Enter message">
    <br>
    <button onclick="sendMessage()">Send</button>

    <h3>Messages from Backend</h3>
    <ul id="messages"></ul>
</div>

<script src="script.js"></script>
</body>
</html>


---

## frontend/script.js

javascript
const backendURL = "/api/messages";

async function loadMessages() {
    const response = await fetch(backendURL);
    const data = await response.json();

    const list = document.getElementById("messages");
    list.innerHTML = "";

    data.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item.text;
        list.appendChild(li);
    });
}

async function sendMessage() {
    const message = document.getElementById("message").value;

    await fetch(backendURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: message })
    });

    document.getElementById("message").value = "";

    loadMessages();
}

loadMessages();


---

## frontend/nginx.conf

nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }

    location /api/ {
        proxy_pass http://backend-service:3000/;
    }
}


---

## frontend/Dockerfile

dockerfile
FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80


---

# STEP 2 — BACKEND APPLICATION

## backend/package.json

json
{
  "name": "backend",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "mongodb": "^5.7.0"
  }
}


---

## backend/server.js

javascript
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const mongoURL = 'mongodb://mongodb-service:27017';
const client = new MongoClient(mongoURL);

let collection;

async function start() {
    await client.connect();

    const db = client.db('demoapp');
    collection = db.collection('messages');

    console.log('Connected to MongoDB');
}

start();

app.get('/messages', async (req, res) => {
    const data = await collection.find().toArray();
    res.json(data);
});

app.post('/messages', async (req, res) => {
    await collection.insertOne({
        text: req.body.text
    });

    res.json({
        status: 'saved'
    });
});

app.listen(3000, () => {
    console.log('Backend running on port 3000');
});


---

## backend/Dockerfile

dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json .

RUN npm install

COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]


---

# STEP 3 — BUILD DOCKER IMAGES

## Build Frontend Image

bash
cd frontend

docker build -t frontend-demo:v1 .


---

## Build Backend Image

bash
cd ../backend

docker build -t backend-demo:v1 .


---

# STEP 4 — TEST LOCALLY USING DOCKER NETWORK

## Create Docker Network continue or jump to default network 

bash
docker network create demo-network
# if Error: could not find free subnet from subnet pools
podman network create --subnet 10.10.0.0/16 demo-network

---

## Start MongoDB

bash
docker run -d --name mongodb --network demo-network mongo:7
# for default network
docker run -d --name mongodb mongo:7
---

## Start Backend

bash
docker run -d --name backend --network demo-network -p 3000:3000 backend-demo:v1
# for default network
docker run -d --name backend -p 3000:3000 backend-demo:v1
---

## Start Frontend

bash
docker run -d --name frontend --network demo-network -p 8080:80 frontend-demo:v1
# for default network
docker run -d --name frontend -p 8080:80 frontend-demo:v1

---

# STEP 5 — PUSH IMAGES TO REGISTRY

## Tag Images

Replace YOUR_DOCKERHUB_USERNAME.

bash
docker tag frontend-demo:v1 YOUR_DOCKERHUB_USERNAME/frontend-demo:v1

docker tag backend-demo:v1 YOUR_DOCKERHUB_USERNAME/backend-demo:v1


---

## Push Images

bash
docker push YOUR_DOCKERHUB_USERNAME/frontend-demo:v1

docker push YOUR_DOCKERHUB_USERNAME/backend-demo:v1


---

# STEP 6 — KUBERNETES DEPLOYMENT

# MongoDB Deployment

## k8s/mongodb-deployment.yaml

yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb

  template:
    metadata:
      labels:
        app: mongodb

    spec:
      containers:
      - name: mongodb
        image: mongo:7
        ports:
        - containerPort: 27017
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
spec:
  selector:
    app: mongodb

  ports:
  - port: 27017
    targetPort: 27017


---

# Backend Deployment

## k8s/backend-deployment.yaml

yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2

  selector:
    matchLabels:
      app: backend

  template:
    metadata:
      labels:
        app: backend

    spec:
      containers:
      - name: backend
        image: YOUR_DOCKERHUB_USERNAME/backend-demo:v1

        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend

  ports:
  - port: 3000
    targetPort: 3000


---

# Frontend Deployment

## k8s/frontend-deployment.yaml

yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 2

  selector:
    matchLabels:
      app: frontend

  template:
    metadata:
      labels:
        app: frontend

    spec:
      containers:
      - name: frontend
        image: YOUR_DOCKERHUB_USERNAME/frontend-demo:v1

        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: NodePort

  selector:
    app: frontend

  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080


---

# STEP 7 — DEPLOY TO KUBERNETES

## Apply All Files

bash
kubectl apply -f k8s/


---

## Verify Pods

bash
kubectl get pods


Expected:


frontend-xxxxx   Running
backend-xxxxx    Running
mongodb-xxxxx    Running


---

## Verify Services

bash
kubectl get svc


Expected:


frontend-service
backend-service
mongodb-service


---

# STEP 8 — ACCESS APPLICATION

Open browser:


http://NODE-IP:30080


Example:


http://192.168.1.100:30080


---

# How Kubernetes Networking Works Here

## Internal Cluster Communication

Frontend talks to backend using:


http://backend-service:3000


Backend talks to MongoDB using:


mongodb-service:27017


This is Kubernetes DNS.

Pods do NOT communicate using Pod IPs in production.

Always use:

* Services
* DNS names
* Load balancing
* Service discovery

That is the enterprise standard.

---

# Important Real-World Improvements

This demo is intentionally simplified.

Real production systems should include:

## 1. Persistent Volumes

MongoDB data will disappear if Pod dies.

Use:

* PV
* PVC
* StorageClass

---

## 2. Secrets

Never hardcode:

* passwords
* database URLs
* API keys

Use:

yaml
kind: Secret


---

## 3. ConfigMaps

Move configuration outside image.

---

## 4. Health Checks

Use:

yaml
livenessProbe
readinessProbe


---

## 5. Ingress Controller

Instead of NodePort.

Production standard:


Ingress + TLS + DNS


---

# Troubleshooting Commands

## Check Logs

bash
kubectl logs deployment/frontend

kubectl logs deployment/backend

kubectl logs deployment/mongodb


---

## Enter Pod

bash
kubectl exec -it deployment/backend -- sh


---

## Test Backend from Frontend Pod

bash
apk add curl

curl http://backend-service:3000/messages


---

## Test MongoDB Connectivity

bash
kubectl exec -it deployment/backend -- sh

ping mongodb-service


---



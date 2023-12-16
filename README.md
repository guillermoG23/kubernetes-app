# kubernetes-app
Este repositorio contiene el trabajo realizado en el contexto de la materia **Kubernetes: Computación en la nube con virtualización liviana** dictada el año 2023 en la Facultad de Ingeniería (FING) de la Universidad de la República (UdelaR) de Uruguay.

El objetivo del trabajo es implementar a través de un Helm *chart* el despliegue de una aplicación que consiste de tres capas (*frontend*, *backend* y base de datos) en un cluster de Kubernetes.

El trabajo se encuentra organizado de la siguiente forma:

- [Requerimientos](#requerimientos): se listan los requerimientos de *hardware* y *software* necesarios.
- [*Chart*](#chart): se aportan detalles sobre el *chart* implementado y su utilización.
- [Aplicación](#aplicación): se dan detalles sobre la aplicación utilizada.
- [Imágenes Docker](#imágenes-docker): se explica como generar las imágenes Docker utilizadas por la aplicación.
- [Trabajo a Futuro](#trabajo-a-futuro): se exponen líneas de mejoras a implementar en un futuro.


## Requerimientos
Los requerimientos necesarios para el despliegue de la aplicación en Kubernetes son listados a continuación.

- [Helm](https://helm.sh/) v3.13.1
- [Kubernetes](https://kubernetes.io/es/) v1.27.2 (para las pruebas se utilizó Kubernetes en [Docker Desktop](https://www.docker.com/products/docker-desktop/) v4.24.2).
- [Kubectl](https://kubernetes.io/es/docs/reference/kubectl/) v1.27
- Al menos 2 vCPU y 4 GB de RAM libres
- Conexión a internet para la descarga de imágenes Docker

## Chart
En esta sección se explica los distintos [recursos de Kubernetes](https://kubernetes.io/docs/reference/kubernetes-api/) modelados en el *chart* y cómo utilizarlo.

### Dependencias
El *chart* tiene como dependencias los siguientes *charts*:

- [ingress-nginx v4.8.3](https://kubernetes.github.io/ingress-nginx)
- [metrics-server v3.11.0](https://kubernetes-sigs.github.io/metrics-server)
- [eck-operator v2.10.0](https://artifacthub.io/packages/helm/elastic/eck-operator)

### Recursos

Para modelar la aplicación de tres capas se utilizaron dos [***Deployments***](./chart/templates/deployments/): uno para el *frontend* y otro para el *backend*; y un [***Statefulset***](./chart/templates/storageclass/) para la base de datos. Para lograr el almacenamiento persistente de la base de datos se definió además un [***StorageClass***](./chart/templates/storageclass/) que utiliza como 
*provisioner* el tipo "docker.io/hostpath". En caso de utilizar otra tecnología para Kubernetes puede que sea necesario que defina nuevos *StorageClass*.

Por otra parte, se tienen tres [***Services***](./chart/templates/services/), uno por cada componente de la aplicación, que permiten el acceso a estos. También se tiene un [***Ingress***](./chart/templates/ingress/) implementado con el [controlador NGINX](https://docs.nginx.com/nginx-ingress-controller/) el cual permite el acceso HTTP al *frontend* y *backend* desde fuera del *cluster* de Kubernetes.

Se implementaron distintos tipos de *liveness probes* y *readiness probes* para las distintas capas de la aplicación. Fueron utilizados los siguientes tipos:
- pedidos HTTP al recurso / para el *frontend*
- en el caso del *backend* contexiones a nivel TCP al puerto del contenedor
- uso de los comandos [mysqladmin](https://dev.mysql.com/doc/refman/8.0/en/mysqladmin.html) y [mysql](https://dev.mysql.com/doc/refman/8.0/en/mysql.html) para establecer conexiones y realizar consultas sobre la base de datos

También se implementó, a través de *init containers*, una dependencia en el despliegue de los contenedores al consultar por la resolución de nombres asociadas a los servicios de cada capa. De esta forma fue posible modelar que primero inicie la base de datos y su servicio asociado, luego el *backend* y su servicio asociado y por último el *frontend* y su servicio. 

Es importante mencionar que se utilizaron [***Secrets***](./chart/templates/secrets/) para almacenar los secretos de la base de datos (como usuario y contraseña) que luego son utilizados en los contenedores.

Por otra parte, tanto para el *frontend* y *backend* se permite el autoesclado horizontal a través del uso del objeto [***HorizontalPodAutoscaler***](./chart/templates/horizontalpodautoscaler/). Para esto es necesario contar con el *metrics server* de Kubernetes.

Por último, se utiliza la tecnología [Elastic Stack](https://www.elastic.co/es/elastic-stack) para el monitoreo de la aplicación a través de [*Application Performance Monitoring*](https://www.elastic.co/es/observability/application-performance-monitoring) (APM) y la recolección de logs de accesos HTTP de NGINX. Para esto se utiliza [Elastic Cloud on Kubernetes](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html) (ECK) para orquestar un despliegue del *stack* y los CRDs (Custom Resource Definitions) de [Elastic](./chart/crds/). El Stack desplegado consiste de [Elasticsearch](./chart/templates/elastic/elasticsearch.yaml) para el almacenamiento de los datos, [Kibana](./chart/templates/elastic/kibana.yaml) para la visualización de los datos, [APM](./chart/templates/elastic/apm.yaml) y [Filebeat](./chart/templates/elastic/filebeat.yaml) para la recolección de eventos y logs y un [ingress](./chart/templates/elastic/ingress.yml) para el acceso HTTPS al servicio. Es importante destacar que para el despliegue del Elastic Stack se utilizaron recursos que pueden ser encontrados en los *quickstarts* de la [documentación de Elastic](https://www.elastic.co/guide/en/cloud-on-k8s/current/k8s-quickstart.html).

### Valores
El despliegue de la aplicación puede ser modificado en base al valor que se asignan a las variables del *chart* especificadas en el archivo [values.yaml](./chart/values.yaml). A continuación se explican cada uno de estos valores.

- **environment**: es utilizado como *labels* para los distintos recursos de Kubernetes
- **pullPolicy**: política para la descarga de las imágenes Docker. Puede tomar los siguientes valores: IfNotPresent (se descarga la imagen solamente si ya no se encuentra de forma local), Always (siempre se descarga la imagen) y Never (nunca se descarga la imagen)
- **rollingUpdate.maxUnavailable**: la cantidad de pods que pueden no estar disponibles durante el proceso de actualización
- **rollingUpdate.maxSurge**: la cantidad de pods que pueden ser creados por encima de la cantidad deseada de pods durante una actualización
- **app.name**: es utilizado como *labels* para los distintos recursos de Kubernetes
- **app.dnsName**: nombre DNS utilizado para acceder a la aplicación. Debe configurar este nombre en su archivo hosts para resolver a una IP (por ejemplo a la localhost). Si modifica este valor debe regenerar la imagen Docker del *backend*, ver sección [Aplicación](#aplicación) para más detalle.
- **app.frontend.imageRepository**: nombre del repositorio desde el cual se obtiene la imagen del *frontend*
- **app.frontend.imageTag**: versión de la imagen del *frontend*
- **app.frontend.replicaCount**: número de replicas de *pods* a utilizar en el *frontend*
- **app.frontend.resources**: bloque donde se especifican los recursos que pueden utilizar los *pods* del *frontend*
- **app.frontend.autoscaling.maxReplicas**: número máximo de replicas de *pods* a las que se puede llegar por un autoescalado del *frontend*
- **app.frontend.autoscaling.cpuAveragePercentageUtilization**: porcentaje de uso de CPU el cual si es excedido se comienza el proceso de autoescalado para el *frontend*
- **app.frontend.livenessProbe.initialDelaySeconds**: cantidad de segundos a esperar antes de comenzar con los *liveness probes* para el *frontend*
- **app.frontend.livenessProbe.periodSeconds**: cantidad de segundos a esperar antes de realizar un nuevo *liveness probe* para el *frontend*
- **app.frontend.readinessProbe.initialDelaySeconds**: cantidad de segundos a esperar antes de comenzar con los *rediness probes* para el *frontend*
- **app.frontend.readinessProbe.periodSeconds**: cantidad de segundos a esperar antes de realizar un nuevo *rediness probe* para el *frontend*
- **app.backend.imageRepository**: nombre del repositorio desde el cual se obtiene la imagen del *backend*
- **app.backend.imageTag**: versión de la imagen del *backend*
- **app.backend.replicaCount**: número de replicas de *pods* a utilizar en el *backend*
- **app.backend.resources**: bloque donde se especifican los recursos que pueden utilizar los *pods* del *backend*
- **app.backend.autoscaling.maxReplicas**: número máximo de replicas de *pods* a las que se puede llegar por un autoescalado del *backend*
- **app.backend.autoscaling.cpuAveragePercentageUtilization**: porcentaje de uso de CPU el cual si es excedido se comienza el proceso de autoescalado para el *backend*
- **app.backend.livenessProbe.initialDelaySeconds**: cantidad de segundos a esperar antes de comenzar con los *liveness probes* para el *backend*
- **app.backend.livenessProbe.periodSeconds**: cantidad de segundos a esperar antes de realizar un nuevo *liveness probe* para el *backend*
- **app.backend.readinessProbe.initialDelaySeconds**: cantidad de segundos a esperar antes de comenzar con los *rediness probes* para el *backend*
- **app.backend.readinessProbe.periodSeconds**: cantidad de segundos a esperar antes de realizar un nuevo *rediness probe* para el *backend*
- **app.init.busybox.imageTag**: versión de la imagen de busybox a utilizar para los *init containers*
- **app.init.curl.imageTag**: versión de la imagen de curl a utilizar para los *init containers*
- **database.mysql.serviceName**: nombre del servicio de la base de datos MYSQL
- **database.mysql.imageTag**: versión de la imagen de MYSQL a utilizar
- **database.mysql.storageAmmount**: tamaño del *storage* utilizado por la base de datos MYSQL
- **database.mysql.dbName**: nombre de la base de datos utilizado por la aplicación
- **database.mysql.resource**: bloque donde se especifican los recursos que pueden utilizar los *pods* de la base de datos MYSQL
- **service.database.externalPort**: puerto en el que se publica el servicio para la base de datos MYSQL
- **service.frontend.externalPort**: puerto en el que se publica el servicio para el *frontend*
- **service.backend.externalPort**: puerto en el que se publica el servicio para el *backend*
- **monitoring.enabled**: habilitar/deshabilitar el monitoreo de la aplicación utilizando el Elastic Stack
- **monitoring.dnsName**: nombre DNS utilizado para acceder a la solución de monitoreo. Debe configurar este nombre en su archivo hosts para resolver a una IP (por ejemplo a la localhost). Si modifica este valor debe regenerar la imagen Docker del *frontend*, ver sección [Aplicación](#aplicación) para más detalle.
- **monitoring.elasticVersion**: versión del Elastic Stack a utilizar
- **secret.database.mysql.rootPassword**: valor de la contraseña de root para la base de datos MYSQL. Debe estar codificado en Base 64 
- **secret.database.mysql.userUsername**: valor del nombre de usuario para la base de datos MYSQL. Debe estar codificado en Base 64
- **secret.database.mysql.userPassword**: valor de la contraseña de usuario para la base de datos MYSQL. Debe estar codificado en Base 64
- **metrics-server.args**: argumentos pasados al chart de metrics-server. En el caso de Docker Desktop es necesario para pasar el valor "--kubelet-insecure-tls" lo cual deshabilita la verificación de certificados
- **ingress-nginx.controller.podAnnotations**: anotaciónes que se asignan a los *pods* utilizados por el *ingress controller* NGINX. Son utilizado para que se pueda ingestar logs de acceso y logs de error de NGINX utilizando Filebeat
- **eck-operator.installCRDs**: se deshabilita la instalación de los CRDs de Elastic por parte del operador ECK. La instalación de los CRDs es realizada directamente por el chart principal y no esta dependencia

Tener en cuenta que si se modifican los valores asociados a los *liveness* y *readiness* *probes* de forma que se especifican pocos segundos, puede ocasionar que los contenedores no tengan tiempo suficiente para inicializar y de esta forma entren en un estado de falla constante.

### Instalación
Para instalar el *chart* seguir los siguientes pasos:

1. Clonar este repositorio:

```
$ git clone https://github.com/guillermoG23/kubernetes-app.git
Cloning into 'kubernetes-app'...

$ cd kubernetes-app
```

2. Obtener las dependencias:

```
$ helm dependency build chart
Getting updates for unmanaged Helm repositories...
...Successfully got an update from the "https://helm.elastic.co" chart repository
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "metrics-server" chart repository
...Successfully got an update from the "ingress-nginx" chart repository
Update Complete. ⎈Happy Helming!⎈
Saving 3 charts
Downloading ingress-nginx from repo https://kubernetes.github.io/ingress-nginx
Downloading metrics-server from repo https://kubernetes-sigs.github.io/metrics-server
Downloading eck-operator from repo https://helm.elastic.co
Deleting outdated charts
```

3. Instalar el *chart* (puede ajustar el nombre de *release*):

```
$ helm install polls chart
NAME: polls
LAST DEPLOYED: Sat Dec  9 10:50:39 2023
NAMESPACE: default
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
El chart polls-app con nombre de release polls está siendo instalado.

Para acceder a la aplicación:

  - Configurar el nombre app.polls.com en su archivo hosts
  - Acceder a la URL http://app.polls.com

Ha habilitado el monitoreo de la aplicación a través de Elastic Observability.

Para acceder al monitoreo:

  - Configurar el nombre kibana.polls.com en su archivo hosts
  - Obtener la contraseña de Elastic: kubectl get secret polls-elasticsearch-es-elastic-user -o go-template='{{.data.elastic | base64decode}}'
  - Acceder a la URL https://kibana.polls.com utilizando el usuario "elastic" y la contraseña obtenida en el punto anterior
      Para visualizar los datos de la aplicación utilizar la URL https://kibana.polls.com/app/apm/services
      Para visualizar los logs de NGINX utilizar la URL https://kibana.polls.com/app/dashboards y buscar el dashboard "[Filebeat Nginx] Overview ECS"
```
Tener en cuenta que la primera vez es necesario descargar las imágenes de los contenedores desde [Docker.hub](https://hub.docker.com/) lo cual puede llevar un tiempo considerable dependiendo de su conexión a internet.

4. Configurar los nombres de dominio **app.polls.com** y **kibana.polls.com** en su archivo hosts.
```
127.0.0.1 app.polls.com kibana.polls.com
```

5. Ingresar a la aplicación con la siguiente URL: **http://app.polls.com**. 

6. En caso de habilitar el monitoreo acceder a Kibana con la URL: **https://kibana.polls.com**. Para la autenticación utilizar el nombre de usuario "elastic" y como contraseña utilizar el valor que obtiene al ejecutar el comando:

```
kubectl get secret polls-elasticsearch-es-elastic-user -o go-template='{{.data.elastic | base64decode}}'
```

7. Una vez instalado el chart, debería obtener una salida similar al ejecutar el siguiente comando:

```
$ kubectl get pods
NAME                                              READY   STATUS    RESTARTS      AGE
elastic-operator-0                                1/1     Running   0             18m
polls-apm-apm-server-c5b895598-2btm4              1/1     Running   0             17m
polls-elasticsearch-es-default-0                  1/1     Running   0             17m
polls-filebeat-pq6nl                              1/1     Running   0             18m
polls-ingress-nginx-controller-578866ccd4-fd2jj   1/1     Running   0             18m
polls-kibana-kb-6fc86b7fc6-2krv8                  1/1     Running   0             17m
polls-metrics-server-595c9bbd77-5zw6m             1/1     Running   0             18m
polls-mysql-database-0                            1/1     Running   0             18m
polls-react-frontend-86648d4b44-nzn5q             1/1     Running   0             18m
polls-react-frontend-86648d4b44-lgrn2             1/1     Running   0             18m
polls-springboot-backend-8646fd94cf-8q4nj         1/1     Running   0             18m
polls-springboot-backend-8646fd94cf-vl7k7         1/1     Running   0             18m
```

Puede modifica los valores del archivo [values.yaml](./chart/values.yaml) para ajustar el despliegue de la aplicación. Por ejemplo, en caso que cuente con recursos de *hardware* muy limitados puede utilizar una sola réplica para el *frontend* y *backend* y deshabilitar el monitoreo de la solución con Elastic Observability.

### Desinstalación
Para desinstalar el *chart* seguir los siguientes pasos:

1. Eliminar *chart*:

```
$ helm delete polls
release "polls" uninstalled
```

2. Eliminar de forma manual el recurso *Persistent Volume Claim* (PVC) que corresponde a MySQL dado que este no es eliminado por el *chart*. Para esto primero obtener el nombre del PVC y luego eliminarlo utilizando el comando kubectl. Esto eliminará de forma automática el *Persistent Volume* (PV) asociado.

```
$ kubectl get pvc
NAME                           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS          AGE
mysql-polls-mysql-database-0   Bound    pvc-14c04774-717e-4cca-b3a9-45ff9267c27d   500Mi      RWO            polls-local-storage   86m

$ kubectl delete pvc mysql-polls-mysql-database-0
persistentvolumeclaim "mysql-polls-mysql-database-0" deleted
```

### Actualización
En caso que ya tenga instalado el *chart* y haya realizado alguna modificación en los valores, puede volver a desplegarlo utilizando el comando:

```
helm upgrade polls chart
```

## Aplicación

La aplicación utilizada es [spring-security-react-ant-design-polls-app](https://github.com/callicoder/spring-security-react-ant-design-polls-app/tree/master) y se encuentra implementada por el usuario de GitHub Callicoder. Es una aplicación de tres capas:

- [Frontend](./app/frontend/): implementado con la tecnología [React](https://es.react.dev/)
- [Backend](./app/backend/): implementado con la tecnología [Spring Boot](https://spring.io/projects/spring-boot).
- Base de datos: utiliza [MySQL](https://www.mysql.com/).

Se trata de una aplicación web que permite interactuar con encuestas. Los usuarios no autenticados solamente pueden ver las encuestas realizadas, así como registrarse e iniciar sesión en la aplicación. Una vez que el usuario se encuentra en sesión, puede realizar las siguientes acciones: ver sus encuestas así como las de otros usuarios, crear nuevas encuestas y votar en encuestas. 

El código fuente de la aplicación se encuentra versionado en este repositorio dado que se hicieron ajustes menores en su código fuente. El código original está disponible en el repositorio [spring-security-react-ant-design-polls-app](https://github.com/callicoder/spring-security-react-ant-design-polls-app/tree/master). A continuación se explican los cambios realizados.

Para el *backend* se ajustó la propiedad **app.cors.allowedOrigins** del archivo [application.properties](./app/backend/src/main/resources/application.properties) para que su valor coincida con el valor **Values.app.dnsName** del *chart*. Si modifica dicho valor del *chart* entonces debe  ajustar esta propiedad del *backend* y regenerar la imagen Docker (ver sección [imágenes Docker](#imágenes-docker) para más detalle de este proceso). Esta propiedad configura los origenes desde los que se permite realizar llamadas cruzadas, [*Cross-Origin Resource Sharing*](https://developer.mozilla.org/es/docs/Web/HTTP/CORS) (CORS).

Por otra parte, para el *frontend* se ajustó el archivo [index.js](./app/frontend/src/index.js) agregando las siguientes líneas de código:

```
import { init as initApm } from '@elastic/apm-rum'

const apm = initApm({
  serviceName: 'polls-frontend',
  serverUrl: 'https://kibana.polls.com',
  serviceVersion: ''
})
```
El valor asignado a la propiedad **serverUrl** debe coincidir con el valor **Values.monitoring.dnsName** del *chart*. Si modifica dicho valor del *chart* entonces debe ajustar esta propiedad en el *frontend* y regenerar la imagen Docker (ver sección [imágenes Docker](#imágenes-docker) para más detalle de este proceso). Estas líneas de codigo permiten monitorear el comportamiento del *frontend* a través de APM.

## Imágenes Docker

Por defecto se utilizan las imágens docker [polls-frontend](https://hub.docker.com/r/guilleguerrero/polls-frontend) y [polls-backend](https://hub.docker.com/r/guilleguerrero/polls-backend) publicadas en Docker Hub.

A continuación se explica como crear las imágenes Docker en caso de ser necesario por algúna modificación en el código fuente.

Para crear la imagen Docker del *frontend*:
```
$ cd app/frontend
$ docker build . -t polls-frontend:1.0.0
```

De forma similar debe proceder para el *backend*:
```
$ cd app/frontend
$ docker build . -t polls-backend:1.0.0
```

Puede ajustar los valores del *tag* utilizado para generar la imagen. Tener en cuenta que para utilizar estas nuevas imágenes debe ajustar los valores **Values.app.frontend.imageRepository**, **Values.app.fronted.imageTag** y **Values.app.backend.imageRepository**, **Values.app.backend.imageTag** del *chart*.

## Trabajo a futuro
Como trabajo a futuro para mejorar el despliegue de la aplicación en Kubernetes se plantean las siguientes líneas de trabajo:

- Utilizar certificados válidos, tanto para los servicios internos (por ejemplo Elasticsearch) como para aquellos servicios que son expuestos a los usuarios, como lo es Kibana, a través de los *ingress*. También sería una mejora importante exponer la aplicación web a través de HTTPS y no HTTP como se encuentra actualmente.
- Hacer uso de un mecanismo de sincronización de la base de datos MySQL de forma que sea posible escalar horizontalmente el *statefulset* y de esta forma tener varias bases de datos que permitan atender a múltiples usuarios de la aplicación en los momentos de mayor carga. En este sentido se puede utilizar como guía la propia [documentación de Kubernetes](https://kubernetes.io/docs/tasks/run-application/run-replicated-stateful-application/) que plantea ejemplos para esto.
- Se podría mejorar el despliegue del Elastic Stack haciendo uso de un clúster de Elasticsearch conformado por múltiples nodos, lo cual brinda resiliencia ante posibles fallas de los nodos.
- Implementar un mecanismo de monitoreo sintético el cual permita identificar problemas de la aplicación. En este sentido Elastic Observability brinda funcionalidades que pueden ser de ayuda.
- Solucionar el *bug* que presenta actualmente la aplicación que hace que un usuario al iniciar sesión vea las encuestas de forma repetida.

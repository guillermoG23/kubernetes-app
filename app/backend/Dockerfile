#### Stage 1: Build the application
FROM maven:3.3-jdk-8 as build
WORKDIR /app
#COPY mvnw .
#COPY .mvn .mvn
COPY pom.xml .
#RUN ./mvnw dependency:go-offline -B
RUN mvn dependency:go-offline -B
COPY src src
#RUN ./mvnw package -DskipTests
RUN mvn package -DskipTests
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

#### Stage 2: A minimal docker image with command to run the app 
FROM openjdk:8-jre-alpine
ARG DEPENDENCY=/app/target/dependency
COPY --from=build ${DEPENDENCY}/BOOT-INF/lib /app/lib
COPY --from=build ${DEPENDENCY}/META-INF /app/META-INF
COPY --from=build ${DEPENDENCY}/BOOT-INF/classes /app

ENTRYPOINT ["java","-cp","app:app/lib/*","com.example.polls.PollsApplication"]

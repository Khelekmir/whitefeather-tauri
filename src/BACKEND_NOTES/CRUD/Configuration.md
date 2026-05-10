Sure, I can provide a detailed explanation of step 2. In this step, you need to register the custom converter with Jackson's `ObjectMapper`. This typically involves creating a configuration class in your Spring Boot application to set up the `ObjectMapper` with the custom converter.

### Creating a Configuration Class

In a Spring Boot application, configuration classes are usually annotated with `@Configuration` and are used to define beans and other configurations. You need to create a configuration class to register your custom converter with the `ObjectMapper`.

#### Step-by-Step Process:

1. **Create the Custom Converter:**
   First, ensure that your custom converter is correctly defined. It should convert a `String` into a `PlayableClass` object.

   ```java
   import com.fasterxml.jackson.databind.util.StdConverter;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.stereotype.Component;
   import practice.feproj.backend.entity.PlayableClass;
   import practice.feproj.backend.repository.PlayableClassRepository;

   @Component
   public class StringToPlayableClassConverter extends StdConverter<String, PlayableClass> {

       @Autowired
       private PlayableClassRepository playableClassRepository;

       @Override
       public PlayableClass convert(String className) {
           return playableClassRepository.findById(className)
                   .orElseThrow(() -> new IllegalArgumentException("PlayableClass not found: " + className));
       }
   }
   ```

2. **Create the Configuration Class:**
   Next, create a configuration class to register the custom converter with the `ObjectMapper`.

   ```java
   import com.fasterxml.jackson.databind.ObjectMapper;
   import com.fasterxml.jackson.databind.module.SimpleModule;
   import org.springframework.context.annotation.Bean;
   import org.springframework.context.annotation.Configuration;
   import practice.feproj.backend.entity.PlayableClass;

   @Configuration
   public class JacksonConfig {

       @Bean
       public ObjectMapper objectMapper(StringToPlayableClassConverter stringToPlayableClassConverter) {
           ObjectMapper objectMapper = new ObjectMapper();
           SimpleModule module = new SimpleModule();
           module.addDeserializer(PlayableClass.class, new StdConverterWrapper<>(stringToPlayableClassConverter));
           objectMapper.registerModule(module);
           return objectMapper;
       }

       private static class StdConverterWrapper<T> extends StdConverter<String, T> {
           private final StdConverter<String, T> delegate;

           public StdConverterWrapper(StdConverter<String, T> delegate) {
               this.delegate = delegate;
           }

           @Override
           public T convert(String value) {
               return delegate.convert(value);
           }
       }
   }
   ```

   In this configuration class:
   - We create a bean for `ObjectMapper`.
   - We create a `SimpleModule` and add the custom deserializer for `PlayableClass`.
   - We register the module with the `ObjectMapper`.

3. **Ensure Spring Boot Uses the Custom ObjectMapper:**
   Spring Boot should automatically use the configured `ObjectMapper`. However, if you have multiple `ObjectMapper` beans or specific requirements, you might need to ensure that the correct `ObjectMapper` is used in your controllers or services.

### Full Example

Putting it all together, here is the complete setup:

**Custom Converter:**

```java
import com.fasterxml.jackson.databind.util.StdConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import practice.feproj.backend.entity.PlayableClass;
import practice.feproj.backend.repository.PlayableClassRepository;

@Component
public class StringToPlayableClassConverter extends StdConverter<String, PlayableClass> {

    @Autowired
    private PlayableClassRepository playableClassRepository;

    @Override
    public PlayableClass convert(String className) {
        return playableClassRepository.findById(className)
                .orElseThrow(() -> new IllegalArgumentException("PlayableClass not found: " + className));
    }
}
```

**Configuration Class:**

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import practice.feproj.backend.entity.PlayableClass;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper(StringToPlayableClassConverter stringToPlayableClassConverter) {
        ObjectMapper objectMapper = new ObjectMapper();
        SimpleModule module = new SimpleModule();
        module.addDeserializer(PlayableClass.class, new StdConverterWrapper<>(stringToPlayableClassConverter));
        objectMapper.registerModule(module);
        return objectMapper;
    }

    private static class StdConverterWrapper<T> extends StdConverter<String, T> {
        private final StdConverter<String, T> delegate;

        public StdConverterWrapper(StdConverter<String, T> delegate) {
            this.delegate = delegate;
        }

        @Override
        public T convert(String value) {
            return delegate.convert(value);
        }
    }
}
```

This configuration ensures that when Jackson deserializes a JSON string into a `PlayableClass` object, it uses the custom converter to look up the `PlayableClass` by its class name. 

With this setup, your JSON payload containing `"playableClass": "Tactician"` will be correctly deserialized into a `PlayableClass` object.